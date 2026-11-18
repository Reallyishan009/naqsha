import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardGrid } from '../../src/codec/index.ts';
import { PASS_STEPS, parseRenderSettings, prepareCloth, renderFrame } from '../../src/simulator/index.ts';
import type { Frame, SlotList } from '../../src/simulator/index.ts';
import { demoPattern } from '../../scripts/demo_pattern.ts';

const PICK_COUNT = 2000;
const VIEWPORT = { width: 1920, height: 1080 };
const SPREAD_PICKS = 120;
const WARM_UP_RENDERS = 10;
const MISSING_PICK = 20;
const DAMAGED_PICK = 30;

type Configuration = { name: string; repeat: number; floatHighlight: { maxLength: number } | null };

const CONFIGURATIONS: Configuration[] = [
  { name: 'repeat 1', repeat: 1, floatHighlight: null },
  { name: 'repeat 2', repeat: 2, floatHighlight: null },
  { name: 'repeat 2 + floatHighlight 4', repeat: 2, floatHighlight: { maxLength: 4 } },
];

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? NaN : sorted[Math.floor(sorted.length / 2)]!;
}

describe('benchmark', () => {
  it(
    'R10.1 R10.2 R10.4 renderFrame at 1920 x 1080 over 2,000 picks returns ok for rest, lift and pass frames; the times are printed, never asserted',
    () => {
      const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
      if (!parsed.ok) throw new Error('demo profile is invalid');
      const profile = parsed.value;

      const slots: Array<CardGrid | null> = [...demoPattern(profile, PICK_COUNT)];
      slots[MISSING_PICK] = null;
      slots[DAMAGED_PICK] = slots[DAMAGED_PICK]!.slice(1); // one hook row removed
      const cloth = prepareCloth(profile, slots as SlotList);
      if (!cloth.ok) throw new Error(`prepareCloth failed: ${cloth.failure.reason}`);

      // Rest, lift and pass frames for picks spread evenly over 0..1999, plus rest at 2000.
      const frames: Frame[] = [];
      for (let i = 0; i < SPREAD_PICKS; i++) {
        const pick = Math.round((i * (PICK_COUNT - 1)) / (SPREAD_PICKS - 1));
        frames.push({ pick, phase: 'rest' });
        // Lift and pass frames exist only for woven picks (R9.3), so the missing and damaged picks get a rest frame only.
        if (pick !== MISSING_PICK && pick !== DAMAGED_PICK) {
          frames.push({ pick, phase: 'lift' }, { pick, phase: 'pass', step: i % PASS_STEPS });
        }
      }
      frames.push({ pick: PICK_COUNT, phase: 'rest' });
      expect(frames.length).toBeGreaterThanOrEqual(300);

      for (const configuration of CONFIGURATIONS) {
        const settings = parseRenderSettings({
          warpColour: '#f4ecd8',
          weftPlan: [
            { kind: 'plain', colour: '#7a1f2b' },
            { kind: 'zari', tone: 'gold' },
          ],
          threadSizePx: 6,
          repeat: configuration.repeat,
          viewport: VIEWPORT,
          floatHighlight: configuration.floatHighlight,
        });
        if (!settings.ok) throw new Error(`parseRenderSettings failed: ${settings.failure.reason}`);

        for (let i = 0; i < WARM_UP_RENDERS; i++) {
          const warm = renderFrame(cloth.value, settings.value, frames[i % frames.length]!);
          expect(warm.ok).toBe(true);
        }

        const all: number[] = [];
        const early: number[] = [];
        const late: number[] = [];
        for (const frame of frames) {
          const start = performance.now();
          const result = renderFrame(cloth.value, settings.value, frame);
          const elapsed = performance.now() - start;
          expect(result.ok).toBe(true);
          all.push(elapsed);
          if (frame.pick < 100) early.push(elapsed);
          if (frame.pick > 1900) late.push(elapsed);
        }

        const sorted = [...all].sort((a, b) => a - b);
        console.log(
          `benchmark: simulator ${VIEWPORT.width}x${VIEWPORT.height}, ${PICK_COUNT} picks, thread size 6, ${configuration.name}, ` +
            `${all.length} frames: median ${median(all).toFixed(2)} ms, p95 ${percentile(sorted, 0.95).toFixed(2)} ms, ` +
            `worst ${sorted[sorted.length - 1]!.toFixed(2)} ms, ` +
            `median p<100 ${median(early).toFixed(2)} ms (${early.length} frames) vs p>1900 ${median(late).toFixed(2)} ms (${late.length} frames)`,
        );
      }
    },
    300_000,
  );
});
