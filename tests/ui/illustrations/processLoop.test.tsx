import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid } from '../../../src/codec/index.ts';
import type { Pattern } from '../../../src/codec/index.ts';
import type { Scheduler } from '../../../src/simulator/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { ProcessLoop } from '../../../src/ui/illustrations/ProcessLoop.tsx';
import { MAX_STEP_MS, createProcessLoop } from '../../../src/ui/illustrations/processLoop.ts';
import {
  CYCLE_MS,
  MAX_SHOWN_PICKS,
  buildProcessScene,
  holdStartMs,
  liftLevel,
  poseAt,
  stillPose,
} from '../../../src/ui/illustrations/processScene.ts';
import type { ProcessPose, ProcessScene } from '../../../src/ui/illustrations/processScene.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { demoProfile } from '../../support/profiles.ts';

const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');
const profile = demoProfile();
const pattern = generateSample(profile, 'diamond');

function sceneOf(forPattern: Pattern = pattern): ProcessScene {
  const result = buildProcessScene(profile, forPattern);
  if (!result.ok) throw new Error('the scene could not be built');
  return result.scene;
}

/** A scheduler that holds one request; `tick(time)` runs it. */
function fakeScheduler(): Scheduler & { tick(timeMs: number): boolean; pending(): boolean; cancelled: number } {
  let callback: ((timeMs: number) => void) | null = null;
  let nextId = 1;
  const fake = {
    cancelled: 0,
    request(cb: (timeMs: number) => void): number {
      callback = cb;
      return nextId++;
    },
    cancel(): void {
      fake.cancelled += 1;
      callback = null;
    },
    tick(timeMs: number): boolean {
      const run = callback;
      callback = null;
      if (run === null) return false;
      run(timeMs);
      return true;
    },
    pending: () => callback !== null,
  };
  return fake;
}

describe('the Process_Loop scene', () => {
  it('weaves the first picks of the pattern, at most MAX_SHOWN_PICKS', () => {
    const scene = sceneOf();
    expect(scene.count).toBe(Math.min(pattern.length, MAX_SHOWN_PICKS));
    expect(scene.cloth.picks).toHaveLength(scene.count);
  });

  it('takes the ends each card lifts from encodeCardGrid, the code the cloth view uses', () => {
    const scene = sceneOf();
    for (let pick = 0; pick < scene.count; pick++) {
      const encoded = encodeCardGrid(profile, pattern[pick]);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) return;
      expect(Array.from(scene.lifts[pick] ?? [])).toEqual(encoded.value.map((lifted) => (lifted ? 1 : 0)));
    }
  });

  it('draws nothing for a profile that is not valid or a pattern with no pick', () => {
    expect(buildProcessScene({ name: 'nope' }, pattern).ok).toBe(false);
    expect(buildProcessScene(profile, []).ok).toBe(false);
    expect(buildProcessScene(profile, 'x').ok).toBe(false);
  });

  it('a damaged card has no lifted ends and no punched hook positions, and the scene is still built', () => {
    const damaged: Pattern = [pattern[0]!, [[true]], pattern[2]!];
    const scene = sceneOf(damaged);
    expect(scene.lifts[1]).toBeNull();
    expect(scene.punched[1]).toBeNull();
  });
});

describe('the Process_Loop timeline', () => {
  it('a cycle is six to eight seconds long and the pose repeats after one cycle', () => {
    const scene = sceneOf();
    expect(CYCLE_MS).toBeGreaterThanOrEqual(6000);
    expect(CYCLE_MS).toBeLessThanOrEqual(8000);
    for (const time of [0, 123, 2000, 4321, 6999]) {
      expect(poseAt(scene, time + CYCLE_MS)).toEqual(poseAt(scene, time));
    }
  });

  it('goes through intro, detail, fast, hold and exit in that order', () => {
    const scene = sceneOf();
    const stages: string[] = [];
    for (let time = 0; time < CYCLE_MS; time += 10) {
      const stage = poseAt(scene, time).stage;
      if (stages[stages.length - 1] !== stage) stages.push(stage);
    }
    expect(stages).toEqual(['intro', 'detail', 'fast', 'hold', 'exit']);
  });

  it('the hold starts before the exit, so the finished cloth is on show for a moment', () => {
    const scene = sceneOf();
    const hold = holdStartMs(scene);
    expect(hold).toBeLessThan(CYCLE_MS - 450);
    const pose = poseAt(scene, hold + 600);
    expect(pose.frame).toEqual({ pick: scene.count, phase: 'rest' });
    expect(pose.clothAlpha).toBe(1);
  });

  it('lights, lifts and passes a weft in the first pick, and the cloth gains a row afterwards', () => {
    const scene = sceneOf();
    const phases = new Set<string>();
    let rows = 0;
    for (let time = 0; time < CYCLE_MS; time += 5) {
      const pose = poseAt(scene, time);
      phases.add(pose.frame.phase);
      expect(pose.frame.pick).toBeGreaterThanOrEqual(rows);
      if (pose.stage !== 'exit') rows = pose.frame.pick;
    }
    expect([...phases].sort()).toEqual(['lift', 'pass', 'rest']);
    expect(rows).toBe(scene.count);
  });

  it('lifts exactly the ends of the card at the head while the weft passes', () => {
    const scene = sceneOf();
    const pose = poseAt(scene, 700 + 750 * 0.5);
    expect(pose.stage).toBe('detail');
    expect(pose.frame.phase).toBe('pass');
    const lift = scene.lifts[0]!;
    for (let end = 0; end < lift.length; end++) expect(liftLevel(scene, pose, end)).toBe(lift[end]);
  });

  it('the picture is blank of cloth at the start and fades the cloth out at the end', () => {
    const scene = sceneOf();
    expect(poseAt(scene, 0).frame).toEqual({ pick: 0, phase: 'rest' });
    expect(poseAt(scene, CYCLE_MS - 1).clothAlpha).toBeLessThan(0.05);
  });

  it('the still pose is the finished cloth with the last card lit and its hooks lifted', () => {
    const scene = sceneOf();
    const pose = stillPose(scene);
    expect(pose.frame).toEqual({ pick: scene.count, phase: 'rest' });
    expect(pose.pos).toBe(scene.count - 1);
    expect(pose.liftAmount).toBe(1);
  });

  it('a pattern of one pick has a full cycle too', () => {
    const scene = sceneOf([pattern[0]!]);
    expect(poseAt(scene, 100).stage).toBe('intro');
    expect(poseAt(scene, 3000).stage).toBe('hold');
    expect(poseAt(scene, 3000).frame).toEqual({ pick: 1, phase: 'rest' });
  });

  it('a time that is not a finite number counts as the start', () => {
    const scene = sceneOf();
    expect(poseAt(scene, Number.NaN)).toEqual(poseAt(scene, 0));
    expect(poseAt(scene, -CYCLE_MS)).toEqual(poseAt(scene, 0));
  });
});

describe('the Process_Loop clock', () => {
  function run(reducedMotion = false) {
    const scene = sceneOf();
    const scheduler = fakeScheduler();
    const poses: ProcessPose[] = [];
    const loop = createProcessLoop({ scene, paint: (pose) => poses.push(pose), scheduler, reducedMotion });
    return { scene, scheduler, poses, loop };
  }

  it('starts with one picture and asks for the next tick', () => {
    const { scheduler, poses, loop } = run();
    loop.start();
    expect(poses).toHaveLength(1);
    expect(scheduler.pending()).toBe(true);
    expect(loop.isRunning()).toBe(true);
  });

  it('counts the time between ticks, not the time of the first tick', () => {
    const { scheduler, loop } = run();
    loop.start();
    scheduler.tick(5000);
    scheduler.tick(5016);
    scheduler.tick(5050);
    expect(loop.elapsedMs()).toBe(50);
  });

  it('never counts more than MAX_STEP_MS for one tick', () => {
    const { scheduler, loop } = run();
    loop.start();
    scheduler.tick(0);
    scheduler.tick(60_000);
    expect(loop.elapsedMs()).toBe(MAX_STEP_MS);
  });

  it('pause stops every frame and resume goes on from where it stopped', () => {
    const { scheduler, poses, loop } = run();
    loop.start();
    scheduler.tick(0);
    scheduler.tick(40);
    loop.pause();
    const shown = poses.length;
    expect(loop.isPaused()).toBe(true);
    expect(scheduler.pending()).toBe(false);
    expect(scheduler.tick(80)).toBe(false);
    expect(poses).toHaveLength(shown);
    loop.resume();
    expect(scheduler.pending()).toBe(true);
    scheduler.tick(10_000);
    scheduler.tick(10_016);
    expect(loop.elapsedMs()).toBe(56);
  });

  it('stops while it is off screen and goes on when it is back', () => {
    const { scheduler, poses, loop } = run();
    loop.start();
    scheduler.tick(0);
    loop.setVisible(false);
    expect(scheduler.pending()).toBe(false);
    const shown = poses.length;
    expect(scheduler.tick(16)).toBe(false);
    expect(poses).toHaveLength(shown);
    loop.setVisible(true);
    expect(scheduler.pending()).toBe(true);
  });

  it('stays paused when it comes back on screen after the user paused it', () => {
    const { scheduler, loop } = run();
    loop.start();
    loop.pause();
    loop.setVisible(false);
    loop.setVisible(true);
    expect(scheduler.pending()).toBe(false);
  });

  it('under Reduced_Motion draws the one finished picture and never asks for a tick', () => {
    const { scene, scheduler, poses, loop } = run(true);
    loop.start();
    loop.resume();
    loop.setVisible(true);
    expect(poses).toEqual([stillPose(scene)]);
    expect(scheduler.pending()).toBe(false);
    expect(loop.isRunning()).toBe(false);
  });

  it('dispose drops the pending request', () => {
    const { scheduler, loop } = run();
    loop.start();
    loop.dispose();
    expect(scheduler.pending()).toBe(false);
    expect(scheduler.tick(16)).toBe(false);
  });
});

describe('ProcessLoop', () => {
  const render = (reducedMotion: boolean, t = en): string =>
    renderToStaticMarkup(<ProcessLoop profile={profile} pattern={pattern} reducedMotion={reducedMotion} t={t} />);

  it('is a canvas with a name and a description, and a pause button with an accessible name', () => {
    const html = render(false);
    expect(html).toContain('<canvas');
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-labelledby="processTitle[^"]+"/);
    expect(html).toMatch(/aria-describedby="processDesc[^"]+"/);
    expect(html).toContain(en('processLoop.title'));
    expect(html).toContain(en('processLoop.pause'));
    expect(html).toContain('data-motion="play"');
  });

  it('under Reduced_Motion describes the still picture and has no pause button', () => {
    const html = render(true);
    expect(html).toContain('data-motion="still"');
    expect(html).not.toContain('<button');
    expect(html).toContain(en('processLoop.desc.still', { picks: MAX_SHOWN_PICKS }));
  });

  it('is written in Hindi when asked', () => {
    const html = render(false, hi);
    expect(html).toContain(hi('processLoop.pause'));
    expect(html).toContain(hi('processLoop.title'));
  });

  it('draws nothing for a profile that is not valid', () => {
    const html = renderToStaticMarkup(
      <ProcessLoop profile={{ ...profile, hookRows: 0 }} pattern={pattern} reducedMotion={false} t={en} />,
    );
    expect(html).toBe('');
  });
});
