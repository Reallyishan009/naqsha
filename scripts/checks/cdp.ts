/**
 * A small Chrome DevTools protocol client for `npm run check:browser`.
 * The message framing and the request/response bookkeeping are separate from the socket, so tests
 * drive them with a fake socket. Only `connectCdp` touches Node's built-in WebSocket (Node 22 and later).
 */
export type CdpParams = Record<string, unknown>;
export type CdpError = { code?: number; message: string; data?: string };

/** What one text frame from the browser means. */
export type CdpMessage =
  | { kind: 'response'; id: number; result: unknown }
  | { kind: 'error'; id: number; error: CdpError }
  | { kind: 'event'; method: string; params: CdpParams; sessionId?: string }
  | { kind: 'invalid'; reason: string };

/** The JSON text of one command. `sessionId` is left out when absent. */
export function encodeCommand(id: number, method: string, params: CdpParams = {}, sessionId?: string): string {
  return JSON.stringify(sessionId === undefined ? { id, method, params } : { id, method, params, sessionId });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Classifies one frame. Never throws; a frame that is not a protocol message is `invalid`. */
export function decodeMessage(text: string): CdpMessage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'not JSON' };
  }
  if (!isRecord(value)) return { kind: 'invalid', reason: 'not an object' };
  if (typeof value.id === 'number') {
    const error = value.error;
    if (isRecord(error) && typeof error.message === 'string') {
      const decoded: CdpError = { message: error.message };
      if (typeof error.code === 'number') decoded.code = error.code;
      if (typeof error.data === 'string') decoded.data = error.data;
      return { kind: 'error', id: value.id, error: decoded };
    }
    return { kind: 'response', id: value.id, result: value.result ?? {} };
  }
  if (typeof value.method === 'string') {
    const event: CdpMessage = { kind: 'event', method: value.method, params: isRecord(value.params) ? value.params : {} };
    if (typeof value.sessionId === 'string') event.sessionId = value.sessionId;
    return event;
  }
  return { kind: 'invalid', reason: 'neither a response nor an event' };
}

/** The part of a socket the client needs. */
export type CdpTransport = { send(text: string): void; close(): void };

type Pending = {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type CdpEventHandler = (params: CdpParams) => void;

export class CdpClient {
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly handlers = new Map<string, Set<CdpEventHandler>>();
  private closed = false;

  private readonly transport: CdpTransport;
  private readonly timeoutMs: number;

  constructor(transport: CdpTransport, timeoutMs = 30_000) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
  }

  /** Sends a command and resolves with its result. Rejects on a protocol error, a timeout or a closed socket. */
  call<T = Record<string, unknown>>(method: string, params: CdpParams = {}): Promise<T> {
    if (this.closed) return Promise.reject(new Error(`CDP ${method}: the connection is closed`));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method}: no answer after ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve: resolve as (result: unknown) => void, reject, timer });
      try {
        this.transport.send(encodeCommand(id, method, params));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Subscribes to one event. Returns the function that unsubscribes. */
  on(method: string, handler: CdpEventHandler): () => void {
    let set = this.handlers.get(method);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(method, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** Feeds one text frame from the socket. Frames that are not protocol messages are ignored. */
  handleMessage(text: string): void {
    const message = decodeMessage(text);
    if (message.kind === 'response' || message.kind === 'error') {
      const entry = this.pending.get(message.id);
      if (entry === undefined) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.kind === 'response') entry.resolve(message.result);
      else entry.reject(new Error(`CDP ${entry.method}: ${message.error.message}${message.error.data ? ` (${message.error.data})` : ''}`));
    } else if (message.kind === 'event') {
      for (const handler of [...(this.handlers.get(message.method) ?? [])]) handler(message.params);
    }
  }

  /** The socket closed: every waiting command is rejected. */
  handleClose(): void {
    this.closed = true;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`CDP ${entry.method}: the connection closed before an answer`));
      this.pending.delete(id);
    }
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  close(): void {
    this.transport.close();
    this.handleClose();
  }
}

/** Opens a WebSocket to a DevTools target and returns a client over it. */
export async function connectCdp(url: string, timeoutMs?: number): Promise<CdpClient> {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error(`could not open the DevTools socket ${url}`)), { once: true });
  });
  const client = new CdpClient({ send: (text) => socket.send(text), close: () => socket.close() }, timeoutMs);
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') client.handleMessage(event.data);
  });
  socket.addEventListener('close', () => client.handleClose());
  return client;
}
