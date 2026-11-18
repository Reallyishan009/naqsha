import type { RenderSettings, SimResult, Weft } from './types.ts';

const COLOUR_PATTERN = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** Reads '#rrggbb' (either case) as [r, g, b], or null for anything else. */
export function parseColour(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = COLOUR_PATTERN.exec(value);
  if (match === null) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

type Checked<T> = { ok: true; value: T } | { ok: false; setting: string; message: string };

function bad(setting: string, message: string): { ok: false; setting: string; message: string } {
  return { ok: false, setting, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkInteger(value: unknown, setting: string, min: number, max: number): Checked<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return bad(setting, `${setting} must be an integer from ${min} to ${max}`);
  }
  return { ok: true, value };
}

function checkColour(value: unknown, setting: string): Checked<string> {
  if (parseColour(value) === null) return bad(setting, `${setting} must be a colour written as #rrggbb`);
  return { ok: true, value: value as string };
}

function checkWeft(entry: unknown, setting: string): Checked<Weft> {
  if (!isRecord(entry)) return bad(setting, `${setting} must be a plain or zari weft`);
  if (entry.kind === 'plain') {
    const colour = checkColour(entry.colour, `${setting}.colour`);
    return colour.ok ? { ok: true, value: { kind: 'plain', colour: colour.value } } : colour;
  }
  if (entry.kind === 'zari') {
    if (entry.tone !== 'gold' && entry.tone !== 'silver') {
      return bad(`${setting}.tone`, `${setting}.tone must be gold or silver`);
    }
    return { ok: true, value: { kind: 'zari', tone: entry.tone } };
  }
  return bad(`${setting}.kind`, `${setting}.kind must be plain or zari`);
}

function check(input: unknown): Checked<RenderSettings> {
  if (!isRecord(input)) return bad('settings', 'settings must be an object');

  // Check order: warpColour, weftPlan (length, then each entry in order), threadSizePx, repeat,
  // viewport (width, then height), floatHighlight. The first invalid field is reported.
  const warpColour = checkColour(input.warpColour, 'warpColour');
  if (!warpColour.ok) return warpColour;

  const plan = input.weftPlan;
  if (!Array.isArray(plan) || plan.length === 0) {
    return bad('weftPlan', 'weftPlan must be a list with at least one weft');
  }
  const weftPlan: Weft[] = [];
  for (let i = 0; i < plan.length; i++) {
    const weft = checkWeft(plan[i], `weftPlan[${i}]`);
    if (!weft.ok) return weft;
    weftPlan.push(weft.value);
  }

  const threadSizePx = checkInteger(input.threadSizePx, 'threadSizePx', 3, 16);
  if (!threadSizePx.ok) return threadSizePx;

  const repeat = input.repeat === undefined ? { ok: true as const, value: 1 } : checkInteger(input.repeat, 'repeat', 1, 64);
  if (!repeat.ok) return repeat;

  if (!isRecord(input.viewport)) return bad('viewport', 'viewport must be an object with width and height');
  const width = checkInteger(input.viewport.width, 'viewport.width', 1, 4096);
  if (!width.ok) return width;
  const height = checkInteger(input.viewport.height, 'viewport.height', 1, 4096);
  if (!height.ok) return height;

  let floatHighlight: RenderSettings['floatHighlight'] = null;
  if (input.floatHighlight !== undefined && input.floatHighlight !== null) {
    if (!isRecord(input.floatHighlight)) {
      return bad('floatHighlight', 'floatHighlight must be null or an object with maxLength');
    }
    const maxLength = checkInteger(input.floatHighlight.maxLength, 'floatHighlight.maxLength', 1, 64);
    if (!maxLength.ok) return maxLength;
    floatHighlight = { maxLength: maxLength.value };
  }

  return {
    ok: true,
    value: {
      warpColour: warpColour.value,
      weftPlan,
      threadSizePx: threadSizePx.value,
      repeat: repeat.value,
      viewport: { width: width.value, height: height.value },
      floatHighlight,
    },
  };
}

/** Checks render settings and returns a fresh copy, or invalid-settings naming the first bad field. Never throws. */
export function parseRenderSettings(input: unknown): SimResult<RenderSettings> {
  let checked: Checked<RenderSettings>;
  try {
    checked = check(input);
  } catch {
    return { ok: false, failure: { reason: 'invalid-settings', setting: 'settings', message: 'settings could not be read' } };
  }
  if (checked.ok) return { ok: true, value: checked.value };
  return { ok: false, failure: { reason: 'invalid-settings', setting: checked.setting, message: checked.message } };
}
