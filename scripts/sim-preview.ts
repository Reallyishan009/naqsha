/**
 * Dev-only simulator preview page (task 3.4). Not part of the app build.
 * Plays the demo pattern on a canvas and shows the median and worst frame time over the last 120 frames.
 *
 * Canvas size: canvas.width/height are the viewport in pixels and the CSS size is the same number of CSS pixels, so the
 * canvas is never scaled by a style/attribute mismatch (image-rendering: pixelated covers high-density phone screens).
 * Fill mode: page width up to 1920, height 16:9 up to 1080. The "1920x1080" toggle forces exactly 1920 x 1080 and the
 * page scrolls sideways if the screen is narrower.
 */
import { parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../src/codec/index.ts';
import {
  browserScheduler,
  createPlayer,
  paintToCanvas,
  parseRenderSettings,
  prepareCloth,
} from '../src/simulator/index.ts';
import type { Player, RenderSettings, Scheduler, SimFailure, SlotList, Weft } from '../src/simulator/index.ts';
import { demoPattern } from './demo_pattern.ts';

const FRAME_WINDOW = 120;
const BUDGET_MS = 16;
const MISSING_PICK = 20;
const DAMAGED_PICK = 30;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('cloth');
const statusEl = $<HTMLPreElement>('status');
const errorEl = $<HTMLDivElement>('error');
const scrub = $<HTMLInputElement>('scrub');
const num = (id: string): number => Number($<HTMLInputElement>(id).value);
const checked = (id: string): boolean => $<HTMLInputElement>(id).checked;
const text = (id: string): string => $<HTMLInputElement>(id).value;

let profile: CardProfile | null = null;
let player: Player | null = null;
let pickCount = 0;
let picksPerSecond = 12;
const frameTimes: number[] = [];
let painted = false;

function parseWeftPlan(source: string): Weft[] | string {
  const plan: Weft[] = [];
  for (const part of source.split(',').map((s) => s.trim()).filter((s) => s !== '')) {
    const [kind, value, ...rest] = part.split(/\s+/);
    if (rest.length > 0 || value === undefined) return `Bad weft "${part}". Use "plain #rrggbb", "zari gold" or "zari silver".`;
    if (kind === 'plain') plan.push({ kind: 'plain', colour: value });
    else if (kind === 'zari' && (value === 'gold' || value === 'silver')) plan.push({ kind: 'zari', tone: value });
    else return `Bad weft "${part}". Use "plain #rrggbb", "zari gold" or "zari silver".`;
  }
  return plan;
}

function viewportSize(): { width: number; height: number } {
  if (checked('full')) return { width: 1920, height: 1080 };
  const width = Math.max(100, Math.min(1920, document.documentElement.clientWidth - 26));
  return { width, height: Math.min(1080, Math.round((width * 9) / 16)) };
}

function showFailure(failure: SimFailure): void {
  if (failure.reason === 'invalid-settings') {
    errorEl.textContent = `Failure: ${failure.reason}, setting "${failure.setting}": ${failure.message}`;
  } else if (failure.reason === 'invalid-profile') {
    errorEl.textContent = `Failure: ${failure.reason}: ${failure.violations.map((v) => `${v.location} ${v.message}`).join('; ')}`;
  } else {
    errorEl.textContent = `Failure: ${failure.reason}, pick ${String(failure.pick)} of ${failure.pickCount}`;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
}

function updateStatus(): void {
  const { width, height } = viewportSize();
  const frame = player?.current();
  const frameText = frame
    ? `pick ${frame.pick}, phase ${frame.phase}${frame.phase === 'pass' ? `, step ${frame.step}` : ''}`
    : 'none';
  const worst = frameTimes.length ? Math.max(...frameTimes) : 0;
  statusEl.textContent =
    `frame: ${frameText}\n` +
    `viewport: ${width} x ${height}\n` +
    `render+paint per painted frame, last ${frameTimes.length}/${FRAME_WINDOW}: median ${median(frameTimes).toFixed(2)} ms, ` +
    `worst ${worst.toFixed(2)} ms (budget ${BUDGET_MS} ms)`;
  if (frame) scrub.value = String(frame.pick);
}

/** Times each scheduler tick (renderFrame plus paint). Only ticks that painted count, so skipped ticks do not lower the median. */
const timedScheduler: Scheduler = {
  request(cb) {
    return browserScheduler.request((timeMs) => {
      painted = false;
      const start = performance.now();
      cb(timeMs);
      const elapsed = performance.now() - start;
      if (painted) {
        frameTimes.push(elapsed);
        if (frameTimes.length > FRAME_WINDOW) frameTimes.shift();
      }
      updateStatus();
    });
  },
  cancel: (id) => browserScheduler.cancel(id),
};

function buildSlots(p: CardProfile, picks: number): SlotList {
  const slots: Array<CardGrid | null> = [...demoPattern(p, picks)];
  if (checked('missing20') && MISSING_PICK < picks) slots[MISSING_PICK] = null;
  if (checked('damaged30') && DAMAGED_PICK < picks) slots[DAMAGED_PICK] = slots[DAMAGED_PICK]!.slice(1); // one hook row removed
  return slots;
}

/** Rebuilds the cloth, settings and player from the page inputs. Returns false and shows the failure when invalid. */
function build(): boolean {
  errorEl.textContent = '';
  if (!profile) return false;
  const plan = parseWeftPlan(text('weftPlan'));
  if (typeof plan === 'string') {
    errorEl.textContent = `Failure: invalid-settings, setting "weftPlan": ${plan}`;
    return false;
  }
  const picks = Math.max(1, Math.floor(num('picks')));
  const settings = parseRenderSettings({
    warpColour: text('warp'),
    weftPlan: plan,
    threadSizePx: num('threadSize'),
    repeat: num('repeat'),
    viewport: viewportSize(),
    floatHighlight: checked('floatOn') ? { maxLength: num('floatLimit') } : null,
  });
  if (!settings.ok) return showFailure(settings.failure), false;
  const cloth = prepareCloth(profile, buildSlots(profile, picks));
  if (!cloth.ok) return showFailure(cloth.failure), false;

  const size = settings.value.viewport;
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  const context = canvas.getContext('2d');
  if (!context) return (errorEl.textContent = 'Failure: no 2d canvas context'), false;
  const paintImage = paintToCanvas(context);
  const resolved: RenderSettings = settings.value;
  player?.pause();
  player = createPlayer({
    cloth: cloth.value,
    settings: resolved,
    paint: (image) => {
      painted = true;
      paintImage(image);
    },
    scheduler: timedScheduler,
  });
  pickCount = picks;
  picksPerSecond = Math.max(1, num('rate'));
  scrub.max = String(picks);
  frameTimes.length = 0;
  return true;
}

function rebuildAndSeek(): void {
  const at = Number(scrub.value);
  if (build()) player!.seek(Math.min(at, pickCount));
  updateStatus();
}

async function start(): Promise<void> {
  const response = await fetch('/profiles/demo-12x16.json');
  if (!response.ok) throw new Error(`/profiles/demo-12x16.json: HTTP ${response.status}`);
  const parsed = parseCardProfile(await response.json());
  if (!parsed.ok) {
    showFailure({ reason: 'invalid-profile', violations: parsed.violations });
    statusEl.textContent = 'Profile invalid.';
    return;
  }
  profile = parsed.value;

  $('play').addEventListener('click', () => {
    if (build()) player!.play(0, pickCount, picksPerSecond);
  });
  $('pause').addEventListener('click', () => {
    player?.pause();
    updateStatus();
  });
  $('resume').addEventListener('click', () => player?.resume());
  scrub.addEventListener('input', () => {
    if (!player && !build()) return;
    player!.seek(Number(scrub.value));
    updateStatus();
  });
  for (const id of ['picks', 'rate', 'threadSize', 'repeat', 'weftPlan', 'warp', 'floatOn', 'floatLimit', 'missing20', 'damaged30', 'full']) {
    $(id).addEventListener('change', rebuildAndSeek);
  }
  rebuildAndSeek();
}

start().catch((error: unknown) => {
  errorEl.textContent = `Failed to start: ${error instanceof Error ? error.message : String(error)}`;
});
