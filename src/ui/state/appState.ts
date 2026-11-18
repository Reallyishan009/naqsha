import type { AppAction, AppState } from '../types.ts';

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

/**
 * Pure reducer. Actions that belong to Phases 2 and 3 (saved designs, Scan_Batch) are not handled yet and
 * return the state unchanged.
 */
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
    case 'confirm-dismissed':
      return { ...state, confirm: null };
    case 'announce':
      return {
        ...state,
        announcement: {
          kind: action.kind,
          messageKey: action.messageKey,
          id: (state.announcement?.id ?? 0) + 1,
        },
      };
    default:
      return state;
  }
}
