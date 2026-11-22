import { flushSync } from 'react-dom';
import type { Dispatch } from 'react';
import type { Translate } from '../../i18n/messages.ts';
import type { ThemeName } from '../../theme/contrast.ts';
import type { AppAction, AppState } from '../../types.ts';
import { Landing } from '../weave/Landing.tsx';

/** The dispatch the Landing uses: a `request-sample` is preceded by the move to Weave, in a render of its own. */
export function sampleThenWeave(dispatch: Dispatch<AppAction>): Dispatch<AppAction> {
  return (action) => {
    if (action.type === 'request-sample') {
      flushSync(() => dispatch({ type: 'navigate', screen: 'weave' }));
    }
    dispatch(action);
  };
}

export type HomeScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Loads the card profile again after it failed; the Landing offers it beside the failure message. */
  onRetryProfile?: () => void;
  /** The theme in use and the handler of the Night loom switch; the Landing's Night section uses both. */
  theme?: ThemeName;
  onThemeChosen?: (theme: ThemeName) => void;
};

/**
 * The first screen: the Landing. A sample chosen on it is requested through the one `request-sample` action (so the
 * same question about unsaved scanned cards applies) and the person is then taken to Weave, where that question or the
 * cloth is shown. The screen changes first and on its own render, so the Weave screen arrives with no design loaded and
 * the design chosen here starts weaving, as a design chosen on Weave does (R8.6).
 */
export function HomeScreen({ state, dispatch, t, onRetryProfile, theme, onThemeChosen }: HomeScreenProps) {
  return <Landing state={state} dispatch={sampleThenWeave(dispatch)} t={t} onRetryProfile={onRetryProfile} theme={theme} onThemeChosen={onThemeChosen} />;
}
