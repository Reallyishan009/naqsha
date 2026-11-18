import type { CardGrid, CardProfile, Violation } from '../codec/index.ts';

/** One entry per pick: the card for that pick, or null for a missing card. Runtime values are still checked as unknown. */
export type SlotList = ReadonlyArray<CardGrid | null>;

export type PickRow =
  | { kind: 'woven'; lift: Uint8Array } // lift[e] = 1 when end e is lifted
  | { kind: 'missing' }
  | { kind: 'damaged'; violations: Violation[] };

export type GapReport = { pick: number; kind: 'missing' | 'damaged'; violations: Violation[] };

export type PreparedCloth = {
  profile: CardProfile;
  baseEnds: number; // hookRows * hookColumns
  picks: ReadonlyArray<PickRow>;
  gaps: ReadonlyArray<GapReport>;
};

export type Weft = { kind: 'plain'; colour: string } | { kind: 'zari'; tone: 'gold' | 'silver' };

export type RenderSettings = {
  warpColour: string; // '#rrggbb'
  weftPlan: ReadonlyArray<Weft>; // non-empty, repeats over picks
  threadSizePx: number; // integer 3..16
  repeat: number; // integer 1..64, default 1
  viewport: { width: number; height: number }; // integers 1..4096
  floatHighlight: { maxLength: number } | null; // maxLength integer 1..64
};

export type Frame =
  | { pick: number; phase: 'rest' } // picks 0..pick-1 woven
  | { pick: number; phase: 'lift' } // shed open for pick `pick`
  | { pick: number; phase: 'pass'; step: number }; // weft part-way

export type SimImage = { width: number; height: number; data: Uint8ClampedArray };

export type SimFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-settings'; setting: string; message: string }
  | { reason: 'pick-out-of-range'; pick: unknown; pickCount: number };

export type SimResult<T> = { ok: true; value: T } | { ok: false; failure: SimFailure };
