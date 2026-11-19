import { describe, expect, it } from 'vitest';
import { createClothPlayer } from '../../../src/ui/screens/weave/ClothCanvas.tsx';
import type { FrameReport } from '../../../src/ui/screens/weave/ClothCanvas.tsx';
import { buildReadyCloth } from '../../../src/ui/screens/weave/WeaveScreen.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { COLOURS } from '../../../src/ui/state/cloth.ts';
import { SPEEDS } from '../../../src/ui/state/playback.ts';
import type { ClothChoices, ReadyCloth } from '../../../src/ui/types.ts';
import type { SimImage } from '../../../src/simulator/index.ts';
import { FakeScheduler } from '../../support/fakes.ts';
import { demoProfile } from '../../support/profiles.ts';

const CHOICES: ClothChoices = {
  warpColour: COLOURS[1]!.hex,
  weftColour: COLOURS[3]!.hex,
  zari: { on: false },
  repeat: 1,
};
const RATE = SPEEDS[1];

function readyCloth(choices: ClothChoices = CHOICES): ReadyCloth {
  const profile = demoProfile();
  const result = buildReadyCloth(profile, generateSample(profile, 'floral'), choices, 320, 192);
  if (!result.ok) throw new Error(`cloth failed: ${result.failure.reason}`);
  return result.value;
}

function harness(ready: ReadyCloth) {
  const scheduler = new FakeScheduler();
  const images: SimImage[] = [];
  const reports: FrameReport[] = [];
  const player = createClothPlayer({
    ready,
    paint: (image) => images.push(image),
    scheduler,
    onFrame: (report) => reports.push(report),
  });
  return { scheduler, images, reports, player };
}

/** Runs ticks every 50 ms until none is pending, at most `limit` ticks. Returns the time of the last tick. */
function runTicks(scheduler: FakeScheduler, startMs: number, limit: number): number {
  let time = startMs;
  for (let tick = 0; tick < limit && scheduler.pending() > 0; tick++) {
    scheduler.run(time);
    time += 50;
  }
  return time;
}

describe('weave wiring', () => {
  it('R2.2 play runs to the last pick and stops', () => {
    const ready = readyCloth();
    const { scheduler, images, reports, player } = harness(ready);
    const count = ready.cloth.picks.length;
    player.play(0, count, RATE);
    runTicks(scheduler, 0, 100_000);
    expect(scheduler.pending()).toBe(0);
    const last = reports[reports.length - 1];
    expect(last?.atEnd).toBe(true);
    expect(last?.frame).toEqual({ pick: count, phase: 'rest' });
    expect(images.length).toBeGreaterThan(count);
  });

  it('R2.3 pause keeps the frame and later ticks paint nothing', () => {
    const ready = readyCloth();
    const { scheduler, images, player } = harness(ready);
    player.play(0, ready.cloth.picks.length, RATE);
    runTicks(scheduler, 0, 8);
    const frame = player.current();
    const painted = images.length;
    player.pause();
    expect(scheduler.pending()).toBe(0);
    expect(scheduler.run(10_000)).toBe(false);
    expect(player.current()).toEqual(frame);
    expect(images.length).toBe(painted);
    player.resume();
    expect(scheduler.pending()).toBe(1);
  });

  it('R2.4 resuming after a pause continues from the paused frame and runs on to the last pick', () => {
    const ready = readyCloth();
    const { scheduler, reports, player } = harness(ready);
    const count = ready.cloth.picks.length;
    player.play(0, count, RATE);
    const pausedAt = runTicks(scheduler, 0, 12);
    const paused = player.current();
    expect(paused.pick).toBeGreaterThan(0);
    player.pause();
    const reportsBefore = reports.length;
    player.resume();
    runTicks(scheduler, pausedAt + 10_000, 100_000);
    const after = reports.slice(reportsBefore);
    expect(after.length).toBeGreaterThan(0);
    // No frame after the resume goes back before the paused pick, so playback did not restart from the first pick.
    for (const report of after) expect(report.frame.pick).toBeGreaterThanOrEqual(paused.pick);
    expect(after[after.length - 1]?.atEnd).toBe(true);
    expect(scheduler.pending()).toBe(0);
  });

  it('R3.6 a colour change keeps the current pick', () => {
    const first = harness(readyCloth());
    first.player.seek(5);
    expect(first.player.current()).toEqual({ pick: 5, phase: 'rest' });
    const next = harness(readyCloth({ ...CHOICES, weftColour: COLOURS[0]!.hex }));
    next.player.seek(first.player.current().pick);
    expect(next.player.current()).toEqual({ pick: 5, phase: 'rest' });
    expect(next.images).toHaveLength(1);
    expect(next.images[0]?.data).not.toEqual(first.images[0]?.data);
  });

  it('R2.9 a seek reports the pick and a seek to the end reports the finished cloth', () => {
    const ready = readyCloth();
    const { reports, player } = harness(ready);
    const count = ready.cloth.picks.length;
    player.seek(count);
    expect(reports[0]).toEqual({ frame: { pick: count, phase: 'rest' }, kind: 'seek', atEnd: true });
    player.seek(2);
    expect(reports[1]?.atEnd).toBe(false);
  });

  it('R4.8 times sample selection to the first painted pick in Node', () => {
    const profile = demoProfile();
    const started = performance.now();
    const pattern = generateSample(profile, 'floral');
    const built = buildReadyCloth(profile, pattern, CHOICES, 360, 216);
    if (!built.ok) throw new Error('cloth failed');
    const { scheduler, images, player } = harness(built.value);
    player.play(0, pattern.length, RATE);
    scheduler.run(0);
    const elapsedMs = performance.now() - started;
    console.log(`sample selection to first painted pick (Node, demo profile, floral): ${elapsedMs.toFixed(1)} ms`);
    expect(images).toHaveLength(1);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
