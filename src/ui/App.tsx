import { Component, lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch, ErrorInfo, ReactNode } from 'react';
import { DICTIONARIES, profileFailureKey, translator } from './i18n/messages.ts';
import type { Translate } from './i18n/messages.ts';
import {
  browserPrefersReducedMotion,
  browserStorage,
  readStoredLanguage,
  setDocumentLanguage,
  storeLanguage,
} from './platform/browser.ts';
import type { KeyValueStorage } from './platform/browser.ts';
import { browserServiceWorkers, isBuiltSite, registerServiceWorker, reloadPage } from './platform/serviceWorker.ts';
import type { ServiceWorkerHandle } from './platform/serviceWorker.ts';
import { loadProfile } from './profile/loadProfile.ts';
import { profileUrl } from './profile/profileUrl.ts';
import styles from './Shell.module.css';
import { KeepScreen } from './screens/keep/KeepScreen.tsx';
import { WeaveScreen } from './screens/weave/WeaveScreen.tsx';
import { appReducer, initialAppState } from './state/appState.ts';
import './theme/tokens.css';
import type { AppAction, AppState, Language, Screen } from './types.ts';

const SCREENS: ReadonlyArray<Screen> = ['weave', 'keep', 'scan'];
const LANGUAGES: ReadonlyArray<Language> = ['hi', 'en'];

type BoundaryProps = { message: string; children: ReactNode };
type BoundaryState = { failed: boolean };

/** Keeps a failing screen from taking down the shell. The shell passes a new `key` per screen, so navigating resets it. */
class ScreenBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The failure is shown as text below; nothing is sent anywhere (R13.1).
  }

  override render(): ReactNode {
    if (this.state.failed) return <p className={styles.screenError}>{this.props.message}</p>;
    return this.props.children;
  }
}

/** The Scan screen is its own chunk, so the camera-free entry stays small (R16.10). */
const ScanScreen = lazy(() => import('./screens/scan/ScanScreen.tsx'));

export type ShellProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** Called when the user picks a language, so the choice can be stored. */
  onLanguageChosen?: (language: Language) => void;
  /** True when a new version of the app is waiting, so the visitor is offered the control that loads it (R24.5). */
  updateReady?: boolean;
  onLoadUpdate?: () => void;
};

/** The shell: navigation, language switch, profile banner, the current screen and one live region. Pure of browser APIs. */
export function Shell({ state, dispatch, onLanguageChosen, updateReady = false, onLoadUpdate }: ShellProps) {
  const t = useMemo(() => translator(DICTIONARIES, state.language), [state.language]);
  const { profile, announcement } = state;
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <nav aria-label={t('nav.label')} className={styles.nav}>
          {SCREENS.map((screen) => (
            <button
              key={screen}
              type="button"
              className={styles.navButton}
              aria-current={state.screen === screen ? 'page' : undefined}
              onClick={() => dispatch({ type: 'navigate', screen })}
            >
              {t(`nav.${screen}`)}
            </button>
          ))}
        </nav>
        <div role="group" aria-label={t('language.label')} className={styles.languages}>
          {LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              lang={language}
              className={styles.languageButton}
              aria-pressed={state.language === language}
              onClick={() => {
                dispatch({ type: 'set-language', language });
                onLanguageChosen?.(language);
              }}
            >
              {translator(DICTIONARIES, language)(`language.${language}`)}
            </button>
          ))}
        </div>
      </header>
      {updateReady ? (
        <div className={styles.updateBanner}>
          <p>{t('update.ready')}</p>
          <button type="button" className={styles.updateButton} onClick={() => onLoadUpdate?.()}>
            {t('update.load')}
          </button>
        </div>
      ) : null}
      {profile.status === 'failed' ? (
        <div className={styles.banner}>
          <p>
            <strong>{t('error.profile.banner')}</strong>
          </p>
          <p>{t(profileFailureKey(profile.failure))}</p>
        </div>
      ) : null}
      {profile.status === 'loading' ? <p className={styles.loading}>{t('status.loading')}</p> : null}
      <main className={styles.main}>
        <ScreenBoundary key={state.screen} message={t('error.generic')}>
          {state.screen === 'weave' ? (
            <WeaveScreen state={state} dispatch={dispatch} t={t} />
          ) : state.screen === 'keep' ? (
            <KeepScreen state={state} dispatch={dispatch} t={t} />
          ) : (
            <Suspense fallback={<p className={styles.loading}>{t('status.loading')}</p>}>
              <ScanScreen state={state} dispatch={dispatch} t={t} />
            </Suspense>
          )}
        </ScreenBoundary>
      </main>
      <div role="status" aria-live="polite" className={styles.liveRegion}>
        {announcement === null ? '' : t(announcement.messageKey, announcement.params)}
      </div>
    </div>
  );
}

export type AppProps = {
  fetchText?: () => Promise<string>;
  storage?: KeyValueStorage | null;
  prefersReducedMotion?: boolean;
};

function defaultFetchText(): Promise<string> {
  return fetch(profileUrl()).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

export function App({ fetchText = defaultFetchText, storage, prefersReducedMotion }: AppProps) {
  const store = storage === undefined ? browserStorage() : storage;
  const [state, dispatch] = useReducer(appReducer, undefined, () => ({
    ...initialAppState,
    language: readStoredLanguage(store) ?? initialAppState.language,
    prefersReducedMotion: prefersReducedMotion ?? browserPrefersReducedMotion(),
  }));

  useEffect(() => {
    let cancelled = false;
    void loadProfile(fetchText).then((loaded) => {
      if (cancelled) return;
      dispatch({ type: 'profile-loaded', state: loaded });
      if (loaded.status === 'failed') {
        dispatch({ type: 'announce', kind: 'error', messageKey: profileFailureKey(loaded.failure) });
      }
    });
    return () => {
      cancelled = true;
    };
    // The profile is loaded once per page (R1.6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDocumentLanguage(state.language);
  }, [state.language]);

  const [updateReady, setUpdateReady] = useState(false);
  const serviceWorker = useRef<ServiceWorkerHandle | null>(null);

  useEffect(() => {
    const container = browserServiceWorkers();
    serviceWorker.current = registerServiceWorker({
      container,
      env: { builtSite: isBuiltSite(), supported: container !== null },
      onUpdateReady: () => setUpdateReady(true),
      reload: reloadPage,
      baseUrl: import.meta.env.BASE_URL,
    });
    // The worker is registered once per page, like the profile above (R24.1).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell
      state={state}
      dispatch={dispatch}
      onLanguageChosen={(language) => storeLanguage(store, language)}
      updateReady={updateReady}
      onLoadUpdate={() => serviceWorker.current?.loadUpdate()}
    />
  );
}
