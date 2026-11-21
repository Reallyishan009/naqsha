import type { Pattern } from '../../codec/index.ts';
import type { AppAction, AppState, ClothChoices, CurrentPattern, RepairState, RepairedSlot } from '../types.ts';
import { appendCard, commitBatch, moveCard, removeCard, replaceCard } from './batch.ts';
import { COLOURS } from './cloth.ts';
import { toggleBreakpoint } from './codeView.ts';

/** The cloth choices the app starts with: the second colour for the warp, the fourth for the weft, no zari. */
export const DEFAULT_CLOTH_CHOICES: ClothChoices = {
  warpColour: COLOURS[1]?.hex ?? '#2b3a67',
  weftColour: COLOURS[3]?.hex ?? '#f1ead8',
  zari: { on: false },
  repeat: 1,
};

/** No accepted repairs. */
export const NO_REPAIRS: RepairState = { picks: [], history: [] };
export const initialAppState: AppState = {
  screen: 'weave',
  language: 'hi',
  profile: { status: 'loading' },
  current: { pattern: [], origin: { kind: 'none' } },
  batch: [],
  confirm: null,
  announcement: null,
  prefersReducedMotion: false,
  selectedPick: 0,
  breakpoints: [],
  clothChoices: DEFAULT_CLOTH_CHOICES,
  compare: null,
  repairs: NO_REPAIRS,
  finishedPattern: null,
};

/**
 * Every action that replaces the Current_Pattern goes through here, so the Selected_Pick returns to pick 0 and the
 * breakpoints are discarded together with the design they were set on (R3.10, R4.6).
 */
function withNewPattern(state: AppState, current: CurrentPattern): AppState {
  return { ...state, current, selectedPick: 0, breakpoints: [], compare: null, repairs: NO_REPAIRS, finishedPattern: null };
}

function lastPickIndex(state: AppState): number {
  return Math.max(0, state.current.pattern.length - 1);
}

/** Pure reducer. */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'navigate':
      return { ...state, screen: action.screen, compare: null };
    case 'profile-loaded':
      return { ...state, profile: action.state };
    case 'set-language':
      return { ...state, language: action.language };
    case 'request-sample': {
      const needsConfirm =
        state.current.origin.kind === 'scanned' &&
        !state.current.origin.saved &&
        state.current.pattern.length > 0;
      if (needsConfirm) {
        return {
          ...state,
          confirm: { kind: 'replace-with-sample', design: action.design, pattern: action.pattern },
        };
      }
      return {
        ...withNewPattern(state, { pattern: action.pattern, origin: { kind: 'sample', design: action.design } }),
        confirm: null,
      };
    }
    case 'confirm-accepted': {
      const { confirm } = state;
      if (confirm === null) return state;
      if (confirm.kind === 'replace-with-sample') {
        return {
          ...withNewPattern(state, { pattern: confirm.pattern, origin: { kind: 'sample', design: confirm.design } }),
          confirm: null,
        };
      }
      // Other confirmations are acted on by the phase that raises them.
      return { ...state, confirm: null };
    }
    case 'open-saved':
      return {
        ...withNewPattern(state, { pattern: action.pattern, origin: { kind: 'archive', id: action.id } }),
        screen: 'weave',
      };
    case 'mark-saved': {
      const { origin } = state.current;
      if (origin.kind !== 'scanned') return state;
      return { ...state, current: { ...state.current, origin: { kind: 'scanned', saved: true } } };
    }
    case 'restore-saved':
      // Same as opening, except the screen stays where it is, so Keep can offer the next save at once.
      return withNewPattern(state, { pattern: action.pattern, origin: { kind: 'archive', id: action.id } });
    case 'set-archive-origin': {
      if (state.current.origin.kind !== 'archive') return state;
      return { ...state, current: { ...state.current, origin: { kind: 'archive', id: action.id } } };
    }
    case 'accept-repairs': {
      // Only picks of the design can change, and only on a click: this action is sent by the Accept controls.
      const items = action.items.filter(
        (item) => Number.isInteger(item.pick) && item.pick >= 0 && item.pick < state.current.pattern.length && Array.isArray(item.card),
      );
      if (items.length === 0) return state;
      const pattern = [...state.current.pattern];
      const before: RepairedSlot[] = [];
      for (const item of items) {
        before.push({ pick: item.pick, before: pattern[item.pick] });
        pattern[item.pick] = item.card;
      }
      const picks = [...new Set([...state.repairs.picks, ...items.map((item) => item.pick)])].sort((a, b) => a - b);
      return {
        ...state,
        current: { ...state.current, pattern },
        repairs: { picks, history: [...state.repairs.history, before] },
        finishedPattern: null,
      };
    }
    case 'undo-repair': {
      const last = state.repairs.history[state.repairs.history.length - 1];
      if (last === undefined) return state;
      const pattern = [...state.current.pattern];
      for (const slot of last) pattern[slot.pick] = slot.before as Pattern[number];
      const undone = new Set(last.map((slot) => slot.pick));
      return {
        ...state,
        current: { ...state.current, pattern },
        repairs: { picks: state.repairs.picks.filter((pick) => !undone.has(pick)), history: state.repairs.history.slice(0, -1) },
        finishedPattern: null,
      };
    }
    case 'compare-versions':
      return { ...state, compare: { first: action.first, second: action.second }, screen: 'code' };
    case 'confirm-dismissed':
      return { ...state, confirm: null };
    case 'announce':
      return {
        ...state,
        announcement: {
          kind: action.kind,
          messageKey: action.messageKey,
          ...(action.params === undefined ? {} : { params: action.params }),
          id: (state.announcement?.id ?? 0) + 1,
        },
      };
    case 'batch-accept':
      return { ...state, batch: appendCard(state.batch, action.grid) };
    case 'batch-remove':
      return { ...state, batch: removeCard(state.batch, action.index) };
    case 'batch-move':
      return { ...state, batch: moveCard(state.batch, action.index, action.by) };
    case 'batch-replace':
      return { ...state, batch: replaceCard(state.batch, action.index, action.grid) };
    case 'batch-commit': {
      // "Done" is disabled while the batch is empty (R11.7).
      if (state.batch.length === 0) return state;
      return {
        ...withNewPattern(state, {
          pattern: commitBatch(state.batch, state.current.pattern, action.mode),
          origin: { kind: 'scanned', saved: false },
        }),
        screen: 'weave',
        batch: [],
        confirm: null,
      };
    }
    case 'select-pick': {
      // No Selected_Pick outside the design can exist (R4.2).
      const wanted = Number.isNaN(action.pick) ? 0 : Math.round(action.pick);
      const pick = Math.min(lastPickIndex(state), Math.max(0, wanted));
      return pick === state.selectedPick ? state : { ...state, selectedPick: pick };
    }
    case 'toggle-breakpoint': {
      // A breakpoint belongs to a pick of the design; any other index has no card to stop on.
      const { pick } = action;
      if (!Number.isInteger(pick) || pick < 0 || pick >= state.current.pattern.length) return state;
      return { ...state, breakpoints: toggleBreakpoint(state.breakpoints, pick) };
    }
    case 'set-cloth-choices':
      return { ...state, clothChoices: action.choices };
    case 'cloth-finished': {
      const { pattern } = state.current;
      if (pattern.length === 0 || state.finishedPattern === pattern) return state;
      return { ...state, finishedPattern: pattern };
    }
    case 'cloth-unfinished':
      return state.finishedPattern === null ? state : { ...state, finishedPattern: null };
    case 'read-failed':
      // The batch stays as it is (R9.1, R11.10). Task 3.2 adds readFailureKey with these same keys.
      return appReducer(state, { type: 'announce', kind: 'error', messageKey: `error.read.${action.failure.reason}` });
    default:
      return state;
  }
}
