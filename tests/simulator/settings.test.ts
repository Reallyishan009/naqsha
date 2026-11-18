import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseColour, parseRenderSettings } from '../../src/simulator/index.ts';
import { renderSettingsArbitrary } from '../support/slots.ts';

type Replacement = { setting: string; settings: Record<string, unknown> };

/** Valid settings with one field replaced by an invalid value, and the setting that must be named. */
const invalidSettingsArbitrary: fc.Arbitrary<Replacement> = renderSettingsArbitrary.chain((valid) => {
  const base: Record<string, unknown> = { ...valid, viewport: { ...valid.viewport } };
  const withField = (setting: string, field: string, value: unknown): Replacement => ({
    setting,
    settings: { ...base, [field]: value },
  });
  const withViewport = (side: 'width' | 'height', value: number): Replacement => ({
    setting: `viewport.${side}`,
    settings: { ...base, viewport: { ...valid.viewport, [side]: value } },
  });
  const badColour = fc.constantFrom<unknown>('#fff', 'ff0000', '#gggggg', '#ff00001', 'red', '', 12, null, {});
  const badThreadSize = fc.oneof(
    fc.constantFrom<unknown>(1, 2, 17, 3.5, NaN, '5', null),
    fc.integer({ min: -100, max: 2 }),
    fc.integer({ min: 17, max: 1000 }),
  );
  const badRepeat = fc.oneof(
    fc.constantFrom<unknown>(0, 65, NaN, '2', null),
    fc.integer({ min: 1, max: 63 }).map((n) => n + 0.5),
    fc.integer({ min: 65, max: 1000 }),
  );
  const badSide = fc.oneof(fc.constantFrom(0, 4097), fc.integer({ min: -100, max: 0 }), fc.integer({ min: 4097, max: 9000 }));
  const badLimit = fc.oneof(fc.constantFrom(0, 65), fc.integer({ min: 65, max: 500 }), fc.integer({ min: -50, max: 0 }));
  const planIndex = fc.integer({ min: 0, max: valid.weftPlan.length - 1 });
  const planWith = (index: number, entry: unknown): unknown[] =>
    valid.weftPlan.map((weft, i) => (i === index ? entry : weft));

  return fc.oneof(
    badColour.map((value) => withField('warpColour', 'warpColour', value)),
    fc.constant(withField('weftPlan', 'weftPlan', [])),
    fc.constantFrom<unknown>(null, 'plain', {}).map((value) => withField('weftPlan', 'weftPlan', value)),
    fc
      .record({ index: planIndex, colour: badColour })
      .map(({ index, colour }) =>
        withField(`weftPlan[${index}].colour`, 'weftPlan', planWith(index, { kind: 'plain', colour })),
      ),
    fc
      .record({ index: planIndex, tone: fc.constantFrom<unknown>('bronze', 'Gold', 1, null) })
      .map(({ index, tone }) => withField(`weftPlan[${index}].tone`, 'weftPlan', planWith(index, { kind: 'zari', tone }))),
    badThreadSize.map((value) => withField('threadSizePx', 'threadSizePx', value)),
    badRepeat.map((value) => withField('repeat', 'repeat', value)),
    fc.record({ side: fc.constantFrom<'width' | 'height'>('width', 'height'), value: badSide }).map(({ side, value }) =>
      withViewport(side, value),
    ),
    badLimit.map((maxLength) => withField('floatHighlight.maxLength', 'floatHighlight', { maxLength })),
  );
});

describe('parseColour', () => {
  it('reads #rrggbb in either case', () => {
    expect(parseColour('#ff8000')).toEqual([255, 128, 0]);
    expect(parseColour('#FF80aB')).toEqual([255, 128, 171]);
  });

  it('rejects short forms, missing #, other strings and non-strings', () => {
    for (const value of ['#fff', 'ff8000', '#ff80000', '#ff800', '#gg0000', 'red', '', ' #ff8000', 1, null, undefined, {}]) {
      expect(parseColour(value)).toBeNull();
    }
  });
});

describe('parseRenderSettings', () => {
  const valid = {
    warpColour: '#102030',
    weftPlan: [{ kind: 'plain', colour: '#aabbcc' }, { kind: 'zari', tone: 'gold' }],
    threadSizePx: 6,
    viewport: { width: 40, height: 30 },
  };

  it('defaults repeat to 1 and floatHighlight to null', () => {
    const result = parseRenderSettings(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.repeat).toBe(1);
    expect(result.value.floatHighlight).toBeNull();
  });

  it('accepts the range limits', () => {
    const result = parseRenderSettings({
      ...valid,
      threadSizePx: 16,
      repeat: 64,
      viewport: { width: 4096, height: 1 },
      floatHighlight: { maxLength: 64 },
    });
    expect(result.ok).toBe(true);
  });

  it('returns a copy that shares no arrays or objects with the input', () => {
    const result = parseRenderSettings(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.weftPlan).not.toBe(valid.weftPlan);
    expect(result.value.weftPlan[0]).not.toBe(valid.weftPlan[0]);
    expect(result.value.viewport).not.toBe(valid.viewport);
    expect(result.value.weftPlan).toEqual(valid.weftPlan);
  });

  it('reports the first invalid field in check order', () => {
    const result = parseRenderSettings({ ...valid, warpColour: 'x', threadSizePx: 1 });
    expect(result).toEqual({ ok: false, failure: expect.objectContaining({ setting: 'warpColour' }) });
    const plan = parseRenderSettings({ ...valid, weftPlan: [valid.weftPlan[0], { kind: 'plain', colour: 'x' }], repeat: 0 });
    expect(plan).toEqual({ ok: false, failure: expect.objectContaining({ setting: 'weftPlan[1].colour' }) });
  });

  it('returns a failure instead of throwing for non-object input', () => {
    for (const input of [undefined, null, 5, 'x', [], () => 1, { get warpColour(): string { throw new Error('x'); } }]) {
      const result = parseRenderSettings(input);
      expect(result.ok).toBe(false);
    }
  });

  it('R5.4 invalid settings fail with invalid-settings naming the setting', () => {
    fc.assert(
      fc.property(invalidSettingsArbitrary, ({ setting, settings }) => {
        const result = parseRenderSettings(settings);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.failure.reason).toBe('invalid-settings');
        if (result.failure.reason !== 'invalid-settings') return;
        expect(result.failure.setting).toBe(setting);
      }),
    );
  });
});
