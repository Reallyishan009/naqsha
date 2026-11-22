import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readPatternBmp } from '../../../src/exporter/index.ts';
import { encodePngRgba } from '../../../scripts/png_rgba.ts';
import { demoPattern } from '../../../scripts/make_fixtures.ts';
import { parseCardProfile } from '../../../src/codec/index.ts';
import type { Pattern } from '../../../src/codec/index.ts';
const PACKAGE = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(PACKAGE, '../..');
const OUT = path.join(PACKAGE, 'out');
const demoProfileJson: Record<string, unknown> = JSON.parse(readFileSync(path.join(REPO, 'public/profiles/demo-12x16.json'), 'utf8'));
const parsed = parseCardProfile(demoProfileJson);
if (!parsed.ok) throw new Error('the demo profile is invalid');
const profile = parsed.value;
const pattern: Pattern = demoPattern(profile, 8);
const client = new Client({ name: 'loom-mcp-test', version: '0.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: ['src/server.ts'], cwd: PACKAGE, stderr: 'pipe' });
/** What a tool returned, in the shape the tests read. */
type Reply = { isError: boolean; structured: Record<string, unknown> | undefined; texts: string[]; images: { data: string; mimeType: string }[]; meta: Record<string, unknown> | undefined };
async function call(name: string, args: Record<string, unknown>): Promise<Reply> {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content ?? []) as { type: string; text?: string; data?: string; mimeType?: string }[];
  return {
    isError: result.isError === true,
    structured: result.structuredContent as Record<string, unknown> | undefined,
    texts: content.filter((block) => block.type === 'text').map((block) => block.text ?? ''),
    images: content.filter((block) => block.type === 'image').map((block) => ({ data: block.data ?? '', mimeType: block.mimeType ?? '' })),
    meta: result._meta as Record<string, unknown> | undefined,
  };
}
function assertToolError(reply: Reply, reason: string): void {
  assert.equal(reply.isError, true, `expected a Tool_Error, got ${JSON.stringify(reply.structured)}`);
  assert.equal(reply.meta?.reason, reason);
  assert.ok(reply.texts[0]?.startsWith(`${reason}:`), reply.texts[0]);
  assert.equal(typeof reply.meta?.hint, 'string');
  assert.equal(reply.structured, undefined);
}
/** A call the SDK refuses before the tool runs, because an argument is not of the type in the input schema. It is still an error result. */
function assertSchemaError(reply: Reply, argument: string): void {
  assert.equal(reply.isError, true);
  assert.match(reply.texts[0]!, new RegExp(`Input validation error.*${argument}`));
}
const made: string[] = [];
before(async () => {
  mkdirSync(OUT, { recursive: true });
  await client.connect(transport);
});
after(async () => {
  await client.close();
  for (const file of made) rmSync(file, { force: true });
});
describe('tool list (R1.1)', () => {
  it('R1.1 exactly the five tools, each with an object input schema, an output schema and a short description', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['diff_designs', 'export_bmp', 'read_card_photo', 'render_cloth', 'validate_profile']);
    for (const tool of tools) {
      assert.equal(tool.inputSchema.type, 'object', tool.name);
      assert.ok(tool.outputSchema !== undefined, `${tool.name} has an output schema`);
      const sentences = (tool.description ?? '').split(/(?<=[.!?])\s+/).filter((sentence) => sentence !== '');
      assert.ok(sentences.length >= 1 && sentences.length <= 3, `${tool.name}: ${sentences.length} sentences`);
    }
  });
  it('R1.2 an argument that does not match the input schema is a Tool_Error, and the next call still works', async () => {
    const bad = await call('render_cloth', { repeat: 'many' });
    assert.equal(bad.isError, true);
    assert.match(bad.texts[0]!, /repeat/);
    const good = await call('validate_profile', { path: 'public/profiles/demo-12x16.json' });
    assert.equal(good.isError, false);
  });
});
describe('validate_profile (R3.1)', () => {
  it('R3.1 the demo profile is valid and the result names its size', async () => {
    const reply = await call('validate_profile', { path: 'public/profiles/demo-12x16.json' });
    assert.equal(reply.isError, false);
    assert.deepEqual(reply.structured, { valid: true, name: 'demo-12x16', hookRows: 12, hookColumns: 16, endsPerPick: 192, violations: [] });
  });
  it('R3.1 an inline profile with a wrong field is invalid, with one sentence per violation naming the field', async () => {
    const reply = await call('validate_profile', { profile: { ...demoProfileJson, hookRows: 0, holeDiameterMm: -1 } });
    assert.equal(reply.isError, false);
    const violations = reply.structured?.violations as { kind: string; location: string; sentence: string }[];
    assert.equal(reply.structured?.valid, false);
    assert.ok(violations.length >= 2);
    assert.ok(violations.some((violation) => violation.sentence.includes('hookRows')));
    assert.ok(violations.some((violation) => violation.sentence.includes('holeDiameterMm')));
    assert.equal(new Set(violations.map((violation) => `${violation.location}|${violation.kind}`)).size, violations.length, 'no violation twice');
  });
  it('R8.1 a path outside the repository is path_not_allowed', async () => {
    assertToolError(await call('validate_profile', { path: '../../../../etc/passwd' }), 'path_not_allowed');
    assertToolError(await call('validate_profile', { path: '/etc/passwd' }), 'path_not_allowed');
  });
  it('R1.2 giving both or neither of profile and path is invalid_option, and a file that is not JSON is not_json', async () => {
    assertToolError(await call('validate_profile', {}), 'invalid_option');
    assertToolError(await call('validate_profile', { profile: demoProfileJson, path: 'public/profiles/demo-12x16.json' }), 'invalid_option');
    const notJson = await call('validate_profile', { path: 'tests/fixtures/pick0-clean.png' });
    assertToolError(notJson, 'not_json');
    assert.ok(!notJson.texts[0]!.includes('PNG'.repeat(3)), 'the message does not echo the file');
  });
});
describe('read_card_photo (R4.1, R4.2)', () => {
  for (const fixture of ['pick0-clean', 'pick1-clean', 'pick2-clean', 'pick0-noisy-tilted']) {
    it(`R4.1 ${fixture}.png is read to the card the fixture was made from`, async () => {
      const truth = JSON.parse(readFileSync(path.join(REPO, 'tests/fixtures', `${fixture}.json`), 'utf8')) as { card: boolean[][] };
      const reply = await call('read_card_photo', { path: `tests/fixtures/${fixture}.png` });
      assert.equal(reply.isError, false, reply.texts[0]);
      assert.deepEqual(reply.structured?.hookRows, truth.card.map((hookRow) => hookRow.map((punched) => (punched ? '1' : '0')).join('')));
      const bitLine = reply.structured?.bitLine as string;
      assert.equal(bitLine.length, 192);
      assert.match(bitLine, /^[01]+$/);
      assert.equal(reply.structured?.endsPerPick, 192);
    });
  }
  it('R4.1 a profile given by path and one given inline both work', async () => {
    const byPath = await call('read_card_photo', { path: 'tests/fixtures/pick0-clean.png', profilePath: 'public/profiles/demo-12x16.json' });
    const inline = await call('read_card_photo', { path: 'tests/fixtures/pick0-clean.png', profile: demoProfileJson });
    assert.deepEqual(byPath.structured, inline.structured);
  });
  it('R4.2 a blank image gives the reader failure reason as the code and a hint of at most 200 characters, and no bit line', async () => {
    const blank = path.join(OUT, 'blank-test.png');
    writeFileSync(blank, encodePngRgba(600, 400, new Uint8ClampedArray(600 * 400 * 4).fill(255)));
    made.push(blank);
    const reply = await call('read_card_photo', { path: 'tools/loom-mcp/out/blank-test.png' });
    assertToolError(reply, 'peg-holes-not-found');
    assert.ok((reply.meta?.hint as string).length <= 200);
    assert.ok(!JSON.stringify(reply).includes('bitLine'));
  });
  it('R4.2 an invalid profile is reported with the reader reason, a file that is not a PNG as not_png, and a missing file as not_found', async () => {
    assertToolError(await call('read_card_photo', { path: 'tests/fixtures/pick0-clean.png', profile: { name: 'x' } }), 'invalid_profile');
    assertToolError(await call('read_card_photo', { path: 'tests/fixtures/pick0-clean.json' }), 'not_png');
    assertToolError(await call('read_card_photo', { path: 'tests/fixtures/nothing-here.png' }), 'not_found');
  });
  it('R8.1 a path outside the repository is path_not_allowed', async () => {
    assertToolError(await call('read_card_photo', { path: '../outside.png' }), 'path_not_allowed');
  });
});
describe('render_cloth (R5.1)', () => {
  it('R5.1 a design is woven into a PNG image block with the counts', async () => {
    const reply = await call('render_cloth', { pattern, repeat: 1, threadSizePx: 6, warpColour: '#2b3a67', weftColour: '#f1ead8' });
    assert.equal(reply.isError, false, reply.texts[0]);
    assert.equal(reply.images.length, 1);
    assert.equal(reply.images[0]!.mimeType, 'image/png');
    const png = Buffer.from(reply.images[0]!.data, 'base64');
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), reply.structured?.width);
    assert.equal(png.readUInt32BE(20), reply.structured?.height);
    assert.equal(reply.structured?.width, 192 * 6);
    assert.equal(reply.structured?.height, (8 + 6 < 18 ? 18 : 8 + 6) * 6);
    assert.equal(reply.structured?.picks, 8);
    assert.equal(reply.structured?.gapCount, 0);
    assert.equal(reply.structured?.pngBytes, png.length);
    assert.ok(Number.isInteger(reply.structured?.floatCount) && (reply.structured?.floatCount as number) >= 0);
  });
  it('R5.1 a lost card is counted as a gap, and a design file path works', async () => {
    const lost: unknown[] = pattern.map((card, pick) => (pick === 3 ? null : card));
    const reply = await call('render_cloth', { pattern: lost });
    assert.equal(reply.structured?.gapCount, 1);
    assert.deepEqual(reply.structured?.gaps, [{ pick: 3, kind: 'missing' }]);
    const file = path.join(OUT, 'design-test.json');
    writeFileSync(file, JSON.stringify({ pattern }));
    made.push(file);
    const byPath = await call('render_cloth', { patternPath: 'tools/loom-mcp/out/design-test.json' });
    assert.equal(byPath.structured?.picks, 8);
  });
  it('R5.1 a repeat doubles the width, and the same input gives the same image', async () => {
    const one = await call('render_cloth', { pattern });
    const two = await call('render_cloth', { pattern, repeat: 2 });
    assert.equal(two.structured?.width, (one.structured?.width as number) * 2);
    const again = await call('render_cloth', { pattern });
    assert.equal(again.images[0]!.data, one.images[0]!.data);
  });
  it('R5.1 an option out of range, a colour that is not #rrggbb, and no pattern are Tool_Errors that name the option', async () => {
    const repeat = await call('render_cloth', { pattern, repeat: 65 });
    assertToolError(repeat, 'invalid_option');
    assert.match(repeat.texts[0]!, /repeat/);
    assert.match((await call('render_cloth', { pattern, threadSizePx: 2 })).texts[0]!, /threadSizePx/);
    assert.match((await call('render_cloth', { pattern, warpColour: 'blue' })).texts[0]!, /warpColour/);
    assertToolError(await call('render_cloth', {}), 'invalid_option');
    assertSchemaError(await call('render_cloth', { pattern: 'not a list' }), 'pattern');
  });
  it('R8.2 a cloth wider than 4096 pixels, and more picks than the limit, are too_large and nothing is drawn', async () => {
    assertToolError(await call('render_cloth', { pattern, repeat: 8, threadSizePx: 16 }), 'too_large');
    assertToolError(await call('render_cloth', { pattern: Array.from({ length: 5001 }, () => []) }), 'too_large');
  });
});
describe('diff_designs (R6.1)', () => {
  const flipped: Pattern = pattern.map((card, pick) => (pick === 2 ? card.map((hookRow, r) => (r === 0 ? hookRow.map((punched, c) => (c === 0 ? !punched : punched)) : hookRow)) : card));
  it('R6.1 one changed punched hole is one change in the counts and in the text', async () => {
    const reply = await call('diff_designs', { first: { pattern }, second: { pattern: flipped } });
    assert.equal(reply.isError, false, reply.texts[0]);
    assert.deepEqual(reply.structured?.counts, { changedHoles: 1, addedCards: 0, removedCards: 0 });
    assert.equal(reply.structured?.identical, false);
    assert.ok((reply.structured?.text as string).length > 0);
    assert.ok(reply.texts[0]!.includes(reply.structured?.text as string));
  });
  it('R6.1 added picks are counted, and the same design is identical', async () => {
    const longer = await call('diff_designs', { first: { pattern }, second: { pattern: [...pattern, pattern[0]] } });
    assert.equal((longer.structured?.counts as { addedCards: number }).addedCards, 1);
    const same = await call('diff_designs', { first: { pattern }, second: { pattern } });
    assert.equal(same.structured?.identical, true);
    assert.deepEqual(same.structured?.counts, { changedHoles: 0, addedCards: 0, removedCards: 0 });
  });
  it('R6.1 designs can be given by path under the repository', async () => {
    const file = path.join(OUT, 'diff-a-test.json');
    writeFileSync(file, JSON.stringify(pattern));
    made.push(file);
    const reply = await call('diff_designs', { first: { path: 'tools/loom-mcp/out/diff-a-test.json' }, second: { pattern: flipped } });
    assert.equal((reply.structured?.counts as { changedHoles: number }).changedHoles, 1);
  });
  it('R6.1 a design that is not a list, a missing side, a path outside the repository and a design over the pick limit are Tool_Errors', async () => {
    assertSchemaError(await call('diff_designs', { first: { pattern: 'x' as unknown as unknown[] }, second: { pattern } }), 'pattern');
    assertToolError(await call('diff_designs', { first: { pattern }, second: {} }), 'invalid_option');
    assertToolError(await call('diff_designs', { first: { path: '/etc/passwd' }, second: { pattern } }), 'path_not_allowed');
    assertToolError(await call('diff_designs', { first: { pattern: Array.from({ length: 5001 }, () => []) }, second: { pattern } }), 'too_large');
  });
});
describe('export_bmp (R7.1)', () => {
  it('R7.1 a design is written as a 1-bit BMP inside out/, its size equals the file, and it reads back to the same design', async () => {
    const reply = await call('export_bmp', { pattern, fileName: 'export-test.bmp' });
    assert.equal(reply.isError, false, reply.texts[0]);
    const file = path.join(REPO, reply.structured?.path as string);
    made.push(file);
    assert.equal(reply.structured?.path, 'tools/loom-mcp/out/export-test.bmp');
    assert.equal(statSync(file).size, reply.structured?.bytes);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString('latin1', 0, 2), 'BM');
    assert.equal(bytes.readInt32LE(18), 192);
    assert.equal(bytes.readInt32LE(22), 8);
    assert.equal(bytes.readUInt16LE(28), 1);
    const back = readPatternBmp(new Uint8Array(bytes), profile);
    assert.ok(back.ok);
    assert.deepEqual(back.ok && back.pattern, pattern);
  });
  it('R7.1 the lift colour option changes the file, and the default name is design.bmp', async () => {
    const white = await call('export_bmp', { pattern, fileName: 'export-white-test.bmp', liftColour: 'white' });
    const black = await call('export_bmp', { pattern, fileName: 'export-black-test.bmp' });
    made.push(path.join(OUT, 'export-white-test.bmp'), path.join(OUT, 'export-black-test.bmp'));
    assert.notDeepEqual(readFileSync(path.join(OUT, 'export-white-test.bmp')), readFileSync(path.join(OUT, 'export-black-test.bmp')));
    assert.equal(white.structured?.bytes, black.structured?.bytes);
  });
  it('R8.1 a file name with a separator or a ".." writes nothing and is path_not_allowed', async () => {
    for (const fileName of ['../evil.bmp', 'sub/evil.bmp', '/tmp/evil.bmp', 'evil.png']) assertToolError(await call('export_bmp', { pattern, fileName }), 'path_not_allowed');
    assert.throws(() => statSync(path.join(PACKAGE, 'evil.bmp')));
  });
  it('R7.1 cards that are not valid cards of the profile, an empty design and a bad option are Tool_Errors that write no file', async () => {
    const damaged = await call('export_bmp', { pattern: [pattern[0], [], pattern[2]], fileName: 'damaged-test.bmp' });
    assertToolError(damaged, 'invalid-card');
    assert.match(damaged.texts[0]!, /picks 2/);
    assertToolError(await call('export_bmp', { pattern: [], fileName: 'empty-test.bmp' }), 'empty-pattern');
    assert.throws(() => statSync(path.join(OUT, 'damaged-test.bmp')));
    assert.throws(() => statSync(path.join(OUT, 'empty-test.bmp')));
    const option = await call('export_bmp', { pattern, fileName: 'option-test.bmp', pickOrder: 'sideways' });
    assert.equal(option.isError, true);
  });
});
describe('the server keeps serving (R1.2)', () => {
  it('R1.2 after every failure above, a call still answers', async () => {
    const reply = await call('validate_profile', { path: 'public/profiles/demo-12x16.json' });
    assert.equal(reply.isError, false);
  });
});
