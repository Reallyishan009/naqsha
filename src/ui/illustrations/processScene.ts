import type { CardProfile } from '../../codec/index.ts';
import { prepareCloth } from '../../simulator/index.ts';
import type { Frame, PreparedCloth } from '../../simulator/index.ts';
import { cardGeometry, punchedHooks } from './cardGeometry.ts';
import type { CardGeometry, PunchedHook } from './cardGeometry.ts';
import { heroLayout } from './heroLayout.ts';
import type { HeroLayout } from './heroLayout.ts';

/*
 * The Process_Loop: what is drawn, and when. A card slides into the Jacquard head, its punched holes light, the
 * hooks of those punched holes lift, a weft passes under the lifted ends and one more pick of cloth is added; then it
 * loops. This file is the pure part: it builds the scene from a Card_Profile and a Pattern with the real
 * pipeline (prepareCloth, which encodes each card with encodeCardGrid) and says what pose the picture is in at any
 * time. It touches no browser API. The drawing is in processPaint.ts.
 */

/** One full cycle, in milliseconds. */
export const CYCLE_MS = 7000;
/** The first card slides in over this long. */
export const INTRO_MS = 700;
/** The first picks are shown in full: card, punched holes, hooks, weft. Each takes this long. */
export const DETAIL_PICK_MS = 750;
/** At most this many picks are shown in full. */
export const MAX_DETAIL_PICKS = 4;
/** The picks after those run faster: the chain of cards moves on and the cloth grows. Each takes this long. */
export const FAST_PICK_MS = 100;
/** At most this many picks are woven in one cycle. */
export const MAX_SHOWN_PICKS = 20;
/** The last card leaves and the cloth fades over this long, at the end of the cycle. */
export const EXIT_MS = 450;
/** The hooks let go this long after the last pick of a cycle. */
export const RELEASE_MS = 250;

/** How far the cloth is stretched along the picks so that a pick is readable on a small picture. */
export const CLOTH_STRETCH = 2;
/** Height of the band the warp ends run through before the shed, in drawing units. */
export const WARP_BAND_UNITS = 70;
/** Space between two cards of the chain, in drawing units. */
export const CARD_GAP_UNITS = 40;
/** The thread size of the cloth image, in pixels: the smallest the simulator allows. */
export const CLOTH_END_PX = 3;
/** How far a card presses on the needles, as a fraction of PRESS_UNITS, while the picks run fast. */
const FAST_PRESS = 0.6;

export type ProcessStage = 'intro' | 'detail' | 'fast' | 'hold' | 'exit';

/** Everything the picture needs from a card profile and a pattern. */
export type ProcessScene = {
  profile: CardProfile;
  geometry: CardGeometry;
  layout: HeroLayout;
  /** The cloth of the first `count` picks, from prepareCloth. */
  cloth: PreparedCloth;
  /** The number of picks woven in one cycle: min(pattern length, MAX_SHOWN_PICKS). At least 1. */
  count: number;
  /** The number of picks shown in full: min(count, MAX_DETAIL_PICKS). */
  detailCount: number;
  /** lifts[pick][end] is 1 when the end lifts; null for a card that is missing or damaged. */
  lifts: ReadonlyArray<Uint8Array | null>;
  /** The punched hook positions of each card, or null when the card does not match the profile. */
  punched: ReadonlyArray<PunchedHook[] | null>;
  /** Size in pixels of the image renderFrame makes. */
  image: { width: number; height: number; threadSizePx: number; shedPx: number };
  /** Size of the whole picture in drawing units. */
  units: { width: number; height: number };
};

export type ProcessSceneResult = { ok: true; scene: ProcessScene } | { ok: false };

/**
 * The scene for a card profile and a pattern, or `{ ok: false }` when the profile is not valid, the pattern has no
 * pick, or the cloth cannot be prepared. Never throws, never changes its input.
 */
export function buildProcessScene(profile: unknown, pattern: unknown): ProcessSceneResult {
  try {
    const geometry = cardGeometry(profile);
    if (!geometry.ok || !Array.isArray(pattern) || pattern.length === 0) return { ok: false };
    const validProfile = profile as CardProfile;
    const count = Math.min(pattern.length, MAX_SHOWN_PICKS);
    const shown: unknown[] = pattern.slice(0, count);
    const prepared = prepareCloth(validProfile, shown);
    if (!prepared.ok) return { ok: false };
    const cloth = prepared.value;
    const layout = heroLayout(validProfile);

    const lifts = cloth.picks.map((pickRow) => (pickRow.kind === 'woven' ? pickRow.lift : null));
    const punched = shown.map((grid) => punchedHooks(validProfile, geometry.geometry, grid));

    const threadSizePx = CLOTH_END_PX;
    const width = cloth.baseEnds * threadSizePx;
    // renderFrame keeps a shed of six thread sizes at the fell, and never more than a third of the image.
    const height = Math.max(18 * threadSizePx, (6 + count) * threadSizePx);
    const shedPx = Math.min(6 * threadSizePx, Math.floor(height / 3));
    const scaleX = layout.card.width / width;
    const clothUnits = height * scaleX * CLOTH_STRETCH;
    const fellY = layout.warp.y + WARP_BAND_UNITS;
    const units = { width: layout.viewBox.width, height: fellY + clothUnits + layout.card.x };

    return {
      ok: true,
      scene: {
        profile: validProfile,
        geometry: geometry.geometry,
        layout,
        cloth,
        count,
        detailCount: Math.min(count, MAX_DETAIL_PICKS),
        lifts,
        punched,
        image: { width, height, threadSizePx, shedPx },
        units,
      },
    };
  } catch {
    return { ok: false };
  }
}

/** The pose of the picture at one moment. */
export type ProcessPose = {
  stage: ProcessStage;
  /** Where the chain of cards is, in card widths: card k is at the head when pos = k; below 0 the first card is still arriving. */
  pos: number;
  /** The hooks and warp ends sit at lerp(lifts[liftFrom], lifts[liftTo], liftAmount); null means no end lifted. */
  liftFrom: number | null;
  liftTo: number | null;
  liftAmount: number;
  /** 0 to 1: how far the card presses on the needles. */
  press: number;
  /** The simulator frame of the cloth image. */
  frame: Frame;
  /** 0 to 1: how much of the cloth shows. */
  clothAlpha: number;
};

const smooth = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const unit = (x: number): number => Math.min(1, Math.max(0, x));

/** How long the picks that run fast take in this scene, in milliseconds. */
export function fastMs(scene: ProcessScene): number {
  return (scene.count - scene.detailCount) * FAST_PICK_MS;
}

/** The start of the hold, in milliseconds from the start of the cycle. */
export function holdStartMs(scene: ProcessScene): number {
  return INTRO_MS + scene.detailCount * DETAIL_PICK_MS + fastMs(scene);
}

const rest = (pick: number): Frame => ({ pick, phase: 'rest' });

/**
 * The pose at `elapsedMs` from the start of a cycle; a time past the end wraps round, and a value that is not a finite
 * number counts as 0. Pure and total: a cycle is CYCLE_MS long whatever the pattern.
 */
export function poseAt(scene: ProcessScene, elapsedMs: number): ProcessPose {
  const time = Number.isFinite(elapsedMs) ? ((elapsedMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS : 0;
  const { count, detailCount, lifts } = scene;
  const last = count - 1;
  const detailEnd = INTRO_MS + detailCount * DETAIL_PICK_MS;
  const holdStart = holdStartMs(scene);
  const exitStart = CYCLE_MS - EXIT_MS;

  if (time < INTRO_MS) {
    return { stage: 'intro', pos: -1 + smooth(time / INTRO_MS), liftFrom: null, liftTo: null, liftAmount: 0, press: 0, frame: rest(0), clothAlpha: 1 };
  }

  if (time < detailEnd) {
    const slot = (time - INTRO_MS) / DETAIL_PICK_MS;
    const pick = Math.min(detailCount - 1, Math.floor(slot));
    const f = slot - pick;
    const woven = lifts[pick] !== null;
    let amount = 0;
    let frame: Frame = rest(pick);
    if (f >= 0.15 && f < 0.35) {
      amount = smooth((f - 0.15) / 0.2);
      if (woven) frame = { pick, phase: 'lift' };
    } else if (f >= 0.35 && f < 0.8) {
      amount = 1;
      if (woven) frame = { pick, phase: 'pass', step: Math.min(7, Math.floor(((f - 0.35) / 0.45) * 8)) };
    } else if (f >= 0.8) {
      amount = f < 0.9 ? 1 - smooth((f - 0.8) / 0.1) : 0;
      frame = rest(pick + 1);
    }
    // The card goes on to the next one in the last tenth of its slot, unless it is the last card of the cycle.
    const advance = pick < last ? smooth((f - 0.9) / 0.1) : 0;
    return { stage: 'detail', pos: pick + advance, liftFrom: null, liftTo: pick, liftAmount: amount, press: amount, frame, clothAlpha: 1 };
  }

  if (time < holdStart) {
    const slot = (time - detailEnd) / FAST_PICK_MS;
    const index = Math.min(count - detailCount - 1, Math.floor(slot));
    const pick = detailCount + index;
    const f = slot - index;
    const advance = pick < last ? smooth((f - 0.4) / 0.6) : 0;
    return {
      stage: 'fast',
      pos: pick + advance,
      liftFrom: index > 0 ? pick - 1 : null,
      liftTo: pick,
      liftAmount: smooth(f / 0.4),
      press: FAST_PRESS,
      frame: rest(f >= 0.4 ? pick + 1 : pick),
      clothAlpha: 1,
    };
  }

  if (time < exitStart) {
    const release = smooth((time - holdStart) / RELEASE_MS);
    const fromFast = count > detailCount;
    return {
      stage: 'hold',
      pos: last,
      liftFrom: fromFast ? last : null,
      liftTo: null,
      liftAmount: release,
      press: fromFast ? FAST_PRESS * (1 - release) : 0,
      frame: rest(count),
      clothAlpha: 1,
    };
  }

  const leave = smooth((time - exitStart) / EXIT_MS);
  return { stage: 'exit', pos: last + leave, liftFrom: null, liftTo: null, liftAmount: 0, press: 0, frame: rest(count), clothAlpha: 1 - leave };
}

/** The one still picture of Reduced_Motion: the cloth finished, the last card in the head with its hooks lifted. */
export function stillPose(scene: ProcessScene): ProcessPose {
  return { stage: 'hold', pos: scene.count - 1, liftFrom: null, liftTo: scene.count - 1, liftAmount: 1, press: FAST_PRESS, frame: rest(scene.count), clothAlpha: 1 };
}

/** Whether the end lifts at `level` 0 to 1 for a pose: the lift sets of the two cards, mixed by the pose. */
export function liftLevel(scene: ProcessScene, pose: ProcessPose, end: number): number {
  const from = pose.liftFrom === null ? null : (scene.lifts[pose.liftFrom] ?? null);
  const to = pose.liftTo === null ? null : (scene.lifts[pose.liftTo] ?? null);
  const a = from === null ? 0 : (from[end] ?? 0);
  const b = to === null ? 0 : (to[end] ?? 0);
  return a + (b - a) * unit(pose.liftAmount);
}
