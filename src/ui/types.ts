import type { CardGrid, CardProfile, Pattern, Violation } from '../codec/index.ts';
import type { PixelData, Pose, ReadFailure as CardReadFailure } from '../reader/index.ts';
import type { PreparedCloth, RenderSettings, SimFailure } from '../simulator/index.ts';

export type Screen = 'weave' | 'keep' | 'scan' | 'code';
export type Language = 'hi' | 'en';

export type ProfileFailure =
  | { reason: 'fetch-failed'; detail: string }
  | { reason: 'not-json' }
  | { reason: 'invalid-profile'; violations: Violation[] };

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: CardProfile }
  | { status: 'failed'; failure: ProfileFailure };

/** Shown when the Card_Profile status text contains UNVERIFIED. */
export type ProfileNotice = { name: string; statusText: string };

export type SampleDesign = 'diamond' | 'border' | 'floral';

/** Where the Current_Pattern came from. Decides whether replacing it needs a confirmation (R4.7). */
export type PatternOrigin =
  | { kind: 'none' }
  | { kind: 'sample'; design: SampleDesign }
  | { kind: 'scanned'; saved: boolean }
  | { kind: 'archive'; id: string };

export type CurrentPattern = { pattern: Pattern; origin: PatternOrigin };

export type Confirm =
  | { kind: 'replace-with-sample'; design: SampleDesign; pattern: Pattern } // the sample waits here until accepted
  | { kind: 'delete-design'; id: string }
  | { kind: 'remove-batch-card'; index: number }
  | { kind: 'commit-batch' }; // replace or append question (R11.8)

/** One side of a comparison: the Current_Pattern, or one saved version. Same shape as the Code view's SideChoice. */
export type CompareChoice = { kind: 'current' } | { kind: 'saved'; id: string };
/** Two sides the Code view should compare as soon as it shows. Set by Keep, cleared on any other navigation. */
export type CompareRequest = { first: CompareChoice; second: CompareChoice };
/** One accepted repair: the pick, and what the Current_Pattern held there before (a gap, so not always a card). */
export type RepairedSlot = { pick: number; before: unknown };
/** Picks whose card came from an accepted suggestion, and one group of slots per accept, for Undo. */
export type RepairState = {
  /** Ascending, no repeats. */
  picks: ReadonlyArray<number>;
  history: ReadonlyArray<ReadonlyArray<RepairedSlot>>;
};
export type AnnouncementParams = Readonly<Record<string, string | number>>;

export type Announcement = {
  kind: 'error' | 'confirmation';
  messageKey: string;
  params?: AnnouncementParams;
  id: number;
};

export type ScanBatch = ReadonlyArray<CardGrid>;

export type AppState = {
  screen: Screen;
  language: Language;
  profile: ProfileState;
  current: CurrentPattern;
  batch: ScanBatch;
  confirm: Confirm | null;
  announcement: Announcement | null;
  prefersReducedMotion: boolean;
  /** The pick both the Weave and the Code view screens show; 0 .. max(0, current.pattern.length - 1) (R4.2). */
  selectedPick: number;
  /** Pick indices with a breakpoint: ascending, no repeat. Screen state only; never saved or exported (R3.10). */
  breakpoints: ReadonlyArray<number>;
  /** The cloth choices made on Weave, shared with Code view (R4.1). */
  clothChoices: ClothChoices;
  /** A comparison Keep asked the Code view to show, or null. */
  compare: CompareRequest | null;
  /** Suggested repairs the weaver accepted into the Current_Pattern. Cleared whenever another design is loaded. */
  repairs: RepairState;
};

export type AppAction =
  | { type: 'navigate'; screen: Screen }
  | { type: 'profile-loaded'; state: ProfileState }
  | { type: 'set-language'; language: Language }
  | { type: 'request-sample'; design: SampleDesign; pattern: Pattern }
  | { type: 'confirm-accepted' }
  | { type: 'confirm-dismissed' }
  | { type: 'open-saved'; id: string; pattern: Pattern }
  | { type: 'mark-saved'; id: string }
  | { type: 'restore-saved'; id: string; pattern: Pattern } // load a version as the open design, stay on this screen
  | { type: 'set-archive-origin'; id: string } // the open design is now this saved version
  | { type: 'compare-versions'; first: CompareChoice; second: CompareChoice }
  | { type: 'accept-repairs'; items: ReadonlyArray<{ pick: number; card: CardGrid }> }
  | { type: 'undo-repair' }
  | { type: 'batch-accept'; grid: CardGrid }
  | { type: 'batch-remove'; index: number }
  | { type: 'batch-move'; index: number; by: -1 | 1 }
  | { type: 'batch-replace'; index: number; grid: CardGrid }
  | { type: 'batch-commit'; mode: 'replace' | 'append' }
  | { type: 'read-failed'; failure: CardReadFailure } // no change to the batch (R9.1)
  | { type: 'announce'; kind: Announcement['kind']; messageKey: string; params?: AnnouncementParams }
  | { type: 'select-pick'; pick: number }
  | { type: 'toggle-breakpoint'; pick: number }
  | { type: 'set-cloth-choices'; choices: ClothChoices };

export type ClothChoices = {
  warpColour: string;
  weftColour: string;
  zari: { on: false } | { on: true; tone: 'gold' | 'silver' };
  repeat: number; // integer 1..8
};

export type ReadyCloth = { cloth: PreparedCloth; settings: RenderSettings };

export type ClothView =
  | { status: 'empty' }
  | { status: 'ready'; ready: ReadyCloth }
  | { status: 'failed'; failure: SimFailure; previous: ReadyCloth | null }; // R2.12

/** Only the status: the pick the screen shows is `AppState.selectedPick` (R4.2). */
export type PlaybackState = { status: 'idle' | 'playing' | 'paused' | 'finished' };

export type HookPosition = { hookRow: number; hookColumn: number };

/** One marker over the card image: `filled` for a punched hole, `ring` for an unpunched hook position (R8.4). */
export type HookMarker = {
  hookRow: number;
  hookColumn: number;
  centrePx: { x: number; y: number };
  shape: 'filled' | 'ring';
  /** True when the position was toggled an odd number of times (R10.4). */
  corrected: boolean;
};

export type ScanState =
  | { status: 'idle' }
  | { status: 'reading'; fileName: string }
  | {
      status: 'read';
      image: PixelData;
      pose: Pose;
      grid: CardGrid;
      readGrid: CardGrid;
      /** One entry per toggle, in order; doubles as the undo stack. */
      corrected: ReadonlyArray<HookPosition>;
      zoom: number;
      replacing: number | null;
    }
  | { status: 'failed'; failure: CardReadFailure };

/** The printable card is refused when the profile or grid is invalid (R21.17). */
export type PrintFailure = { reason: 'invalid-card'; violations: Violation[] };

/** English dictionary: flat key to text. */
export type Dictionary = Readonly<Record<string, string>>;
export type HiEntry = { text: string; reviewed: boolean };
/** Hindi dictionary: flat key to text with a per-key reviewed flag (R12.11). */
export type HiDictionary = Readonly<Record<string, HiEntry>>;
export type Dictionaries = { en: Dictionary; hi: HiDictionary };
export type ReviewEntry = { key: string; hi: string; en: string };
