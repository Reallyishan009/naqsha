import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
/** A failure the caller can act on. The reason is a stable code, the hint says what to do. */
export class ToolError extends Error {
  readonly reason: string;
  readonly hint: string;
  constructor(reason: string, message: string, hint: string) {
    super(message);
    this.name = 'ToolError';
    this.reason = reason;
    this.hint = hint;
  }
}
export type ToolFailure = { ok: false; reason: string; message: string; hint: string };
/** A successful result: a one-line text for the reader, the structured data, and optional extra content such as an image. */
export function succeed<T extends Record<string, unknown>>(
  structured: T,
  summary: string,
  extra: CallToolResult['content'] = [],
): CallToolResult {
  return { content: [{ type: 'text', text: summary }, ...extra], structuredContent: structured };
}
/** A Tool_Error result: isError is true and the structured content names the reason and the hint. */
export function failure(reason: string, message: string, hint: string): CallToolResult {
  const structured: ToolFailure = { ok: false, reason, message, hint };
  return { isError: true, content: [{ type: 'text', text: `${reason}: ${message} Hint: ${hint}` }], structuredContent: structured };
}
/**
 * Runs a tool body. A ToolError becomes its own result; anything else becomes `internal_error` with no stack and no
 * file content, so a bug in a tool never ends the server and never leaks what it was reading.
 */
export async function guarded(body: () => CallToolResult | Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ToolError) return failure(error.reason, error.message, error.hint);
    const kind = error instanceof Error ? error.name : 'unknown error';
    return failure('internal_error', `The tool stopped on an unexpected ${kind}.`, 'Check the input and try again; if it keeps happening, report it.');
  }
}
