import type { AppAction, AppState } from '../types.ts';
import { appendCard, commitBatch, moveCard, removeCard, replaceCard } from './batch.ts';

export const initialAppState: AppState = {
  screen: 'weave',
  language: 'hi',
  profile: { status: 'loading' },
  current: { pattern: [], origin: { kind: 'none' } },
  batch: [],
  confirm: null,
  announcement: null,
  prefersReducedMotion: false,
};

/** Pure reducer. */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'navigate':
      return { ...state, screen: action.screen };
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
        ...state,
        current: { pattern: action.pattern, origin: { kind: 'sample', design: action.design } },
        confirm: null,
      };
    }
    case 'confirm-accepted': {
      const { confirm } = state;
      if (confirm === null) return state;
      if (confirm.kind === 'replace-with-sample') {
        return {
          ...state,
          current: { pattern: confirm.pattern, origin: { kind: 'sample', design: confirm.design } },
          confirm: null,
        };
      }
      // Other confirmations are acted on by the phase that raises them.
      return { ...state, confirm: null };
    }
    case 'open-saved':
      return {
        ...state,
        screen: 'weave',
        current: { pattern: action.pattern, origin: { kind: 'archive', id: action.id } },
      };
    case 'mark-saved': {
      const { origin } = state.current;
      if (origin.kind !== 'scanned') return state;
      return { ...state, current: { ...state.current, origin: { kind: 'scanned', saved: true } } };
    }
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
        ...state,
        screen: 'weave',
        current: {
          pattern: commitBatch(state.batch, state.current.pattern, action.mode),
          origin: { kind: 'scanned', saved: false },
        },
        batch: [],
        confirm: null,
      };
    }
    case 'read-failed':
      // The batch stays as it is (R9.1, R11.10). Task 3.2 adds readFailureKey with these same keys.
      return appReducer(state, { type: 'announce', kind: 'error', messageKey: `error.read.${action.failure.reason}` });
    default:
      return state;
  }
}
