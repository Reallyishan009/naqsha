import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CdpClient, decodeMessage, encodeCommand } from '../../scripts/checks/cdp.ts';

const SEED = 60303;
const NUM_RUNS = 100;

class FakeTransport {
  sent: string[] = [];
  closed = false;
  send(text: string): void {
    this.sent.push(text);
  }
  close(): void {
    this.closed = true;
  }
}

const jsonValue = fc.jsonValue();
const paramsArb = fc.dictionary(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,8}$/), jsonValue, { maxKeys: 4 });

describe('CDP framing', () => {
  it('encodes a command with an id, a method and params, and a session id only when given', () => {
    expect(JSON.parse(encodeCommand(3, 'Page.enable'))).toEqual({ id: 3, method: 'Page.enable', params: {} });
    expect(JSON.parse(encodeCommand(4, 'X.y', { a: 1 }, 'S'))).toEqual({ id: 4, method: 'X.y', params: { a: 1 }, sessionId: 'S' });
  });

  it('decodes a response, an error, an event, and rejects anything else without throwing', () => {
    expect(decodeMessage('{"id":1,"result":{"a":2}}')).toEqual({ kind: 'response', id: 1, result: { a: 2 } });
    expect(decodeMessage('{"id":1}')).toEqual({ kind: 'response', id: 1, result: {} });
    expect(decodeMessage('{"id":2,"error":{"code":-32000,"message":"no"}}')).toEqual({
      kind: 'error',
      id: 2,
      error: { code: -32000, message: 'no' },
    });
    expect(decodeMessage('{"method":"Page.loadEventFired","params":{"timestamp":1}}')).toEqual({
      kind: 'event',
      method: 'Page.loadEventFired',
      params: { timestamp: 1 },
    });
    for (const text of ['', 'nope', '[]', '3', '{"x":1}']) expect(decodeMessage(text).kind).toBe('invalid');
  });

  it('R23.1 an encoded command parses back to the same id, method and params, and a response keeps its id', () => {
    fc.assert(
      fc.property(fc.nat(1_000_000), fc.stringMatching(/^[A-Z][a-z]{1,8}\.[a-z][a-zA-Z]{1,12}$/), paramsArb, (id, method, params) => {
        expect(JSON.parse(encodeCommand(id, method, params))).toEqual({ id, method, params });
        expect(decodeMessage(JSON.stringify({ id, result: params }))).toEqual({ kind: 'response', id, result: params });
        expect(decodeMessage(JSON.stringify({ method, params }))).toEqual({ kind: 'event', method, params });
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('CdpClient', () => {
  it('matches each answer to its command by id, in any order', async () => {
    const transport = new FakeTransport();
    const client = new CdpClient(transport, 1000);
    const first = client.call('A.one');
    const second = client.call('B.two', { x: 1 });
    expect(transport.sent.map((text) => JSON.parse(text).id)).toEqual([1, 2]);
    client.handleMessage('{"id":2,"result":{"which":"second"}}');
    client.handleMessage('{"id":1,"result":{"which":"first"}}');
    await expect(first).resolves.toEqual({ which: 'first' });
    await expect(second).resolves.toEqual({ which: 'second' });
    expect(client.pendingCount).toBe(0);
  });

  it('rejects a command with the protocol error, and ignores unknown ids and bad frames', async () => {
    const client = new CdpClient(new FakeTransport(), 1000);
    const call = client.call('Bad.method');
    client.handleMessage('garbage');
    client.handleMessage('{"id":99,"result":{}}');
    client.handleMessage('{"id":1,"error":{"message":"not found"}}');
    await expect(call).rejects.toThrow('CDP Bad.method: not found');
  });

  it('rejects after the timeout and when the connection closes; later calls fail at once', async () => {
    const slow = new CdpClient(new FakeTransport(), 20);
    await expect(slow.call('Slow.call')).rejects.toThrow('no answer after 20 ms');
    expect(slow.pendingCount).toBe(0);
    const client = new CdpClient(new FakeTransport(), 1000);
    const waiting = client.call('Waiting.call');
    client.handleClose();
    await expect(waiting).rejects.toThrow('closed before an answer');
    await expect(client.call('After.close')).rejects.toThrow('closed');
  });

  it('delivers events to every subscriber until it unsubscribes', () => {
    const client = new CdpClient(new FakeTransport(), 1000);
    const seen: unknown[] = [];
    const off = client.on('Log.entryAdded', (params) => seen.push(params));
    client.on('Log.entryAdded', (params) => seen.push({ again: params }));
    client.handleMessage('{"method":"Log.entryAdded","params":{"entry":1}}');
    off();
    client.handleMessage('{"method":"Log.entryAdded","params":{"entry":2}}');
    expect(seen).toEqual([{ entry: 1 }, { again: { entry: 1 } }, { again: { entry: 2 } }]);
  });

  it('R23.1 every answer reaches its own caller whatever order the answers arrive in', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }).chain((count) =>
          fc.shuffledSubarray(Array.from({ length: count }, (_, index) => index + 1), { minLength: count, maxLength: count }),
        ),
        async (arrival) => {
          const client = new CdpClient(new FakeTransport(), 1000);
          const calls = arrival.map((_, index) => client.call(`M.m${index + 1}`));
          for (const id of arrival) client.handleMessage(JSON.stringify({ id, result: { id } }));
          for (const [index, call] of calls.entries()) await expect(call).resolves.toEqual({ id: index + 1 });
          expect(client.pendingCount).toBe(0);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
