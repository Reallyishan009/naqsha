import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Scheduler } from '../../../simulator/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { AppAction, AppState } from '../../types.ts';
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
};

/**
 * The weave player, with its empty state while the Current_Pattern has no pick. The arrival (the design already loaded
 * and the pick the other screen left) is taken here, once, so a design chosen later is a new design for the player and
 * starts playing (R8.6).
 */
export function WeaveScreen({ state, dispatch, t, scheduler }: WeaveScreenProps) {
  const [arrival] = useState<Arrival>(() => ({
    pattern: state.current.pattern,
    pick: state.selectedPick,
    finished: state.finishedPattern === state.current.pattern,
  }));
  return <WeavePlayer state={state} dispatch={dispatch} t={t} arrival={arrival} scheduler={scheduler} />;
}
