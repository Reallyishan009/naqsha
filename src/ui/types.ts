import type { CardGrid, CardProfile, Pattern, Violation } from '../codec/index.ts';
import type { PixelData, Pose, ReadFailure as CardReadFailure } from '../reader/index.ts';
import type { PreparedCloth, RenderSettings, SimFailure } from '../simulator/index.ts';

export type Screen = 'weave' | 'keep' | 'scan';
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
  | { kind: 'replace-with-sample'; design: SampleDesign }
  | { kind: 'delete-design'; id: string }
  | { kind: 'remove-batch-card'; index: number }
  | { kind: 'commit-batch' }; // replace or append question (R11.8)

export type Announcement = { kind: 'error' | 'confirmation'; messageKey: string; id: number };

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
  | { type: 'batch-accept'; grid: CardGrid }
  | { type: 'batch-remove'; index: number }
  | { type: 'batch-move'; index: number; by: -1 | 1 }
  | { type: 'batch-replace'; index: number; grid: CardGrid }
  | { type: 'batch-commit'; mode: 'replace' | 'append' }
  | { type: 'read-failed'; failure: CardReadFailure } // no change to the batch (R9.1)
  | { type: 'announce'; kind: Announcement['kind']; messageKey: string };

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

export type PlaybackState =
  | { status: 'idle'; pick: number }
  | { status: 'playing'; pick: number }
  | { status: 'paused'; pick: number }
  | { status: 'finished'; pick: number };

export type HookPosition = { hookRow: number; hookColumn: number };

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
