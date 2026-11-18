import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoPattern } from '../../scripts/make_fixtures.ts';
import { parseCardProfile } from '../../src/codec/index.ts';
import { readCard } from '../../src/reader/readCard';
import { padPixelData, renderCardPixels } from '../support/images';

/** The rendered image is 70 x 55 mm (card plus border). 19 px/mm gives 1330 x 1045, which fits 1920 x 1080. 20 px/mm would be 1100 high. */
const PIXELS_PER_MM = 19;
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const TIMED_READS = 5;

describe('benchmark', () => {
  it(
    'R16.2 readCard on the demo card padded to 1920 x 1080 reads the card; the time is printed, never asserted',
    () => {
      const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
      if (!parsed.ok) throw new Error('demo profile is invalid');
      const profile = parsed.value;
      const card = demoPattern(profile)[0]!;

      const rendered = renderCardPixels(profile, card, {
        noise: 0,
        tiltDegrees: 0,
        shade: 0,
        seed: 1,
        pixelsPerMm: PIXELS_PER_MM,
      });
      expect(rendered.width).toBeLessThanOrEqual(FRAME_WIDTH);
      expect(rendered.height).toBeLessThanOrEqual(FRAME_HEIGHT);
      const left = Math.floor((FRAME_WIDTH - rendered.width) / 2);
      const top = Math.floor((FRAME_HEIGHT - rendered.height) / 2);
      const frame = padPixelData(rendered, {
        left,
        top,
        right: FRAME_WIDTH - rendered.width - left,
        bottom: FRAME_HEIGHT - rendered.height - top,
        level: 255,
      });
      expect(frame.width).toBe(FRAME_WIDTH);
      expect(frame.height).toBe(FRAME_HEIGHT);

      const readOnce = (): number => {
        const start = performance.now();
        const result = readCard(profile, frame);
        const elapsed = performance.now() - start;
        if (!result.ok) expect.fail(`readCard failed with ${result.failure.reason}`);
        expect(result.grid).toEqual(card);
        return elapsed;
      };

      readOnce(); // warm-up
      const times = Array.from({ length: TIMED_READS }, readOnce).sort((a, b) => a - b);
      const median = times[Math.floor(TIMED_READS / 2)]!;
      console.log(
        `benchmark: readCard ${FRAME_WIDTH}x${FRAME_HEIGHT} at ${PIXELS_PER_MM} px/mm, ` +
          `median ${median.toFixed(1)} ms (min ${times[0]!.toFixed(1)}, max ${times[TIMED_READS - 1]!.toFixed(1)})`,
      );
    },
    120_000,
  );
});
