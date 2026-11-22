import type { CardGrid, Violation } from '../codec/index.ts';
/** The three ways a lost card is guessed. */
export type SuggestionKind = 'repeat' | 'mirror' | 'neighbours';
/** Shown in words, never by colour alone. */
export type Confidence = 'high' | 'medium' | 'low';
/** All pick indices below are 0-based, as in a Pattern. */
export type Evidence =
  | {
      kind: 'repeat';
      /** The distance, in picks, at which cards agree. */
      period: number;
      /** The readable picks the proposed card was taken from, all at a multiple of `period` from the gap. */
      supportingPicks: number[];
      /** Pairs of picks `period` apart that were both readable, and how many of them hold equal cards. */
      comparedPairs: number;
      agreeingPairs: number;
    }
  | {
      kind: 'mirror';
      /** The sum of the two pick indices of a mirrored pair: the centre of the mirror is this divided by 2. */
      centreSum: number;
      /** The pick the proposed card was copied from. */
      partnerPick: number;
      comparedPairs: number;
      agreeingPairs: number;
    }
  | { kind: 'neighbours'; beforePick: number; afterPick: number };
export type Suggestion = {
  kind: SuggestionKind;
  confidence: Confidence;
  /** A copy of a readable card; the pattern is never changed. */
  card: CardGrid;
  evidence: Evidence;
};
export type NotAppliedReason =
  | 'too-few-readable-cards'
  | 'no-period'
  | 'no-supporter'
  | 'supporters-tie'
  | 'no-mirror'
  | 'centre-pick'
  | 'partner-out-of-chain'
  | 'partner-unreadable'
  | 'at-chain-edge'
  | 'neighbour-unreadable'
  | 'neighbours-differ';
/** Why a gap has no suggestion at all. */
export type NoSuggestionReason = 'no-readable-cards' | 'too-short' | 'no-evidence';
export type GapRepair = {
  pick: number;
  /** `missing` when the slot holds nothing, `damaged` when it is not a card of the profile. */
  gapKind: 'missing' | 'damaged';
  /** Best first: high before medium before low, then repeat, mirror, neighbours. */
  suggestions: Suggestion[];
  /** True when the suggestions do not all propose the same card. Both are kept; none is chosen. */
  conflict: boolean;
  /** Each of the three kinds appears exactly once, here or in `suggestions`. */
  notApplied: { kind: SuggestionKind; reason: NotAppliedReason }[];
  /** Set only when `suggestions` is empty. */
  none: NoSuggestionReason | null;
};
export type RepairFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'not-a-pattern' };
export type RepairResult =
  | { ok: true; gaps: GapRepair[]; pickCount: number; readableCount: number }
  | { ok: false; failure: RepairFailure };
