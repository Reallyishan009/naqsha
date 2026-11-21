import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Scheduler } from '../../../simulator/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { ThemeName } from '../../theme/contrast.ts';
import type { AppAction, AppState } from '../../types.ts';
import { Landing } from './Landing.tsx';
import { WeavePlayer } from './WeavePlayer.tsx';
import type { Arrival } from './WeavePlayer.tsx';

// The Weave tests and Code view reach these through this file, where they lived before the screen was split.
export { buildReadyCloth, RiseSkipControl } from './WeavePlayer.tsx';

export type WeaveScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests can drive time; the browser uses requestAnimationFrame. */
  scheduler?: Scheduler;
  /** Loads the card profile again after it failed; the Landing offers it beside the failure message. */
  onRetryProfile?: () => void;
  /** The theme in use and the handler of the Night loom switch; the Landing's Night section uses both. */
  theme?: ThemeName;
  onThemeChosen?: (theme: ThemeName) => void;
};

/**
 * The Landing while the Current_Pattern has no pick, and the weave player once it has one. The arrival (the design
 * already loaded and the pick the other screen left) is taken here, once, so a design chosen on the Landing is a new
 * design for the player and starts playing (R8.6).
 */
export function WeaveScreen({ state, dispatch, t, scheduler, onRetryProfile, theme, onThemeChosen }: WeaveScreenProps) {
  const [arrival] = useState<Arrival>(() => ({
    pattern: state.current.pattern,
    pick: state.selectedPick,
    finished: state.finishedPattern === state.current.pattern,
  }));
  if (state.current.pattern.length === 0) {
    return <Landing state={state} dispatch={dispatch} t={t} onRetryProfile={onRetryProfile} theme={theme} onThemeChosen={onThemeChosen} />;
  }
  return <WeavePlayer state={state} dispatch={dispatch} t={t} arrival={arrival} scheduler={scheduler} />;
}
