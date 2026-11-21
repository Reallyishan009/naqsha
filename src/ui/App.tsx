import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ComponentType, Dispatch, ErrorInfo, ReactNode } from 'react';
import { DICTIONARIES, profileFailureKey, translator } from './i18n/messages.ts';
import type { Translate } from './i18n/messages.ts';
import {
  browserPrefersDark,
  browserPrefersReducedMotion,
  browserStorage,
  readStoredLanguage,
  readStoredTheme,
  setDocumentLanguage,
  storeLanguage,
  storeTheme,
} from './platform/browser.ts';
import type { KeyValueStorage } from './platform/browser.ts';
import { browserServiceWorkers, isBuiltSite, registerServiceWorker, reloadPage } from './platform/serviceWorker.ts';
import type { ServiceWorkerHandle } from './platform/serviceWorker.ts';
import { loadProfile } from './profile/loadProfile.ts';
import { profileUrl } from './profile/profileUrl.ts';
import { Button } from './components/Button.tsx';
import { LoadingState } from './components/LoadingState.tsx';
import { Notice } from './components/Notice.tsx';
import { StateMessage } from './components/StateMessage.tsx';
import { Selvedge } from './components/Selvedge.tsx';
import { Tabs } from './components/Tabs.tsx';
import { ThemeSwitch } from './components/ThemeSwitch.tsx';
import { NavIcon } from './illustrations/NavIcons.tsx';
import styles from './Shell.module.css';
import { KeepScreen } from './screens/keep/KeepScreen.tsx';
import { WeaveScreen } from './screens/weave/WeaveScreen.tsx';
import { appReducer, initialAppState } from './state/appState.ts';
import type { ThemeName } from './theme/contrast.ts';
import { applyTheme, chooseTheme } from './theme/theme.ts';
import './theme/tokens.css';
import type { AppAction, AppState, Language, Screen } from './types.ts';

const SCREENS: ReadonlyArray<Screen> = ['weave', 'keep', 'scan', 'code'];
const LANGUAGES: ReadonlyArray<Language> = ['hi', 'en'];

type BoundaryProps = {
  message: string;
  t: Translate;
  /** Remounts the Screen (and asks for its chunk again); the Shell passes a new key, so this boundary starts fresh. */
  onRetry: () => void;
  children: ReactNode;
};
type BoundaryState = { failed: boolean };

/**
 * Keeps a failing screen from taking down the shell. The shell passes a new `key` per screen and per attempt, so
 * navigating or retrying resets it. The failure is an error StateMessage: it announces itself once through its own
 * `role="alert"` when it appears, and focus is never moved to it.
 */
export class ScreenBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The failure is shown as text below; nothing is sent anywhere (R13.1).
  }

  override render(): ReactNode {
    const { message, t, onRetry } = this.props;
    if (this.state.failed) {
      return <StateMessage variant="error" message={message} retry={{ label: t('state.retry'), onRetry }} t={t} />;
    }
    return this.props.children;
  }
}

type ScreenModule<P> = { default: ComponentType<P> };

/**
 * A lazy Screen component that is made again for each attempt. `React.lazy` keeps a rejected import for good, so a
 * retry needs a new component; the module system still fetches a chunk that loaded once only once.
 */
export function useLazyScreen<P extends object>(importer: () => Promise<ScreenModule<P>>, attempt: number): ComponentType<P> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => lazy(importer), [importer, attempt]);
}

/** The Scan screen is its own chunk, so the camera-free entry stays small (R16.10). */
const importScanScreen = () => import('./screens/scan/ScanScreen.tsx');

/** The Code view screen is its own chunk, requested on the first open of Code view in a page session (R9.1). */
const importCodeViewScreen = () => import('./screens/code/CodeViewScreen.tsx');

/** The message key a failed screen shows: Code view names itself, because its chunk can fail to load (R9.10). */
export function screenErrorKey(screen: Screen): string {
  return screen === 'code' ? 'error.codeview.load' : 'error.generic';
}

export type ShellProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** Called when the user picks a language, so the choice can be stored. */
  onLanguageChosen?: (language: Language) => void;
  /** The chosen theme. It lives in App, not in the AppState reducer, so a change cannot touch the pattern, language or Screen (R4.9). */
  theme?: ThemeName;
  /** Called when the user flips the Night loom switch, so the choice can be stored and applied. */
  onThemeChosen?: (theme: ThemeName) => void;
  /** True when a new version of the app is waiting, so the visitor is offered the control that loads it (R24.5). */
  updateReady?: boolean;
  onLoadUpdate?: () => void;
  /** Loads the card profile again after it failed; the Landing offers it beside the failure message. */
  onRetryProfile?: () => void;
};

/** The shell: navigation, language switch, profile banner, the current screen and one live region. Pure of browser APIs. */
export function Shell({ state, dispatch, onLanguageChosen, theme = 'day', onThemeChosen, updateReady = false, onLoadUpdate, onRetryProfile }: ShellProps) {
  const t = useMemo(() => translator(DICTIONARIES, state.language), [state.language]);
  const { profile, announcement } = state;
  // Each retry of a Screen that failed to load adds one: the Screen is remounted and its chunk is asked for again.
  const [screenAttempt, setScreenAttempt] = useState(0);
  const ScanScreen = useLazyScreen(importScanScreen, screenAttempt);
  const CodeViewScreen = useLazyScreen(importCodeViewScreen, screenAttempt);
  // The Landing shows the profile's loading and failure itself, with its own retry.
  const landingShowsProfile = state.screen === 'weave' && state.current.pattern.length === 0;
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Selvedge />
        <div className={styles.bar}>
          <h1 className={styles.title}>{t('app.title')}</h1>
          <div className={styles.switches}>
            <Tabs
              label={t('language.label')}
              items={LANGUAGES.map((language) => ({
                key: language,
                lang: language,
                label: translator(DICTIONARIES, language)(`language.${language}`),
              }))}
              current={state.language}
              onChoose={(key) => {
                const language: Language = key === 'en' ? 'en' : 'hi';
                dispatch({ type: 'set-language', language });
                onLanguageChosen?.(language);
              }}
            />
            <ThemeSwitch
              theme={theme}
              label={t('theme.label')}
              stateText={t(theme === 'night' ? 'theme.on' : 'theme.off')}
              onChoose={(next) => onThemeChosen?.(next)}
            />
          </div>
          <nav aria-label={t('nav.label')} className={styles.nav}>
            {SCREENS.map((screen) => (
              <button
                key={screen}
                type="button"
                className={styles.navButton}
                aria-current={state.screen === screen ? 'page' : undefined}
                onClick={() => dispatch({ type: 'navigate', screen })}
              >
                {/* The label is the first text of the button; CSS `order: -1` puts the icon in front of it. */}
                {t(`nav.${screen}`)}
                <NavIcon screen={screen} className={styles.navIcon} />
                {screen === 'code' ? <span className={styles.navAdvanced}>{t('nav.advanced')}</span> : null}
              </button>
            ))}
          </nav>
        </div>
      </header>
      {updateReady ? (
        <div className={styles.noticeSlot}>
          <Notice
            variant="information"
            word={t('notice.information')}
            action={<Button onClick={() => onLoadUpdate?.()}>{t('update.load')}</Button>}
          >
            {t('update.ready')}
          </Notice>
        </div>
      ) : null}
      {profile.status === 'failed' ? (
        <div className={styles.noticeSlot}>
          {/* No role: the Shell's live region and the Screens already announce a profile failure. The Landing offers
              the retry beside its own failure message, so the Shell offers it only on the other Screens. */}
          <StateMessage
            variant="error"
            role={null}
            message={t('error.profile.banner')}
            next={t(profileFailureKey(profile.failure))}
            retry={landingShowsProfile || onRetryProfile === undefined ? undefined : { label: t('state.retry'), onRetry: onRetryProfile }}
            t={t}
          />
        </div>
      ) : null}
      {profile.status === 'loading' && !landingShowsProfile ? (
        <div className={styles.noticeSlot}>
          <LoadingState text={t('status.loading')} />
        </div>
      ) : null}
      <main className={styles.main}>
        <ScreenBoundary
          key={`${state.screen}:${screenAttempt}`}
          message={t(screenErrorKey(state.screen))}
          t={t}
          onRetry={() => setScreenAttempt((attempt) => attempt + 1)}
        >
          {state.screen === 'weave' ? (
            <WeaveScreen state={state} dispatch={dispatch} t={t} onRetryProfile={onRetryProfile} />
          ) : state.screen === 'keep' ? (
            <KeepScreen state={state} dispatch={dispatch} t={t} />
          ) : state.screen === 'scan' ? (
            <Suspense fallback={<LoadingState text={t('status.screen')} />}>
              <ScanScreen state={state} dispatch={dispatch} t={t} />
            </Suspense>
          ) : (
            <Suspense fallback={<LoadingState text={t('status.screen')} />}>
              <CodeViewScreen state={state} dispatch={dispatch} t={t} />
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

  // Each retry adds one, so the effect below runs again and loads the profile once more.
  const [profileAttempt, setProfileAttempt] = useState(0);
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
    // The profile is loaded once per page, and again only when the weaver asks after a failure (R1.6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileAttempt]);

  useEffect(() => {
    setDocumentLanguage(state.language);
  }, [state.language]);

  // The theme is not in the reducer: changing it touches no AppState field (R4.9). The inline script of index.html
  // chose the same value before the first paint, from the same inputs.
  const [theme, setTheme] = useState<ThemeName>(() => chooseTheme(readStoredTheme(store), browserPrefersDark()));
  useLayoutEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);

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
      theme={theme}
      onThemeChosen={(next) => {
        // A refused store leaves the choice applied for this page session and shows nothing (R4.5).
        storeTheme(store, next);
        setTheme(next);
      }}
      updateReady={updateReady}
      onLoadUpdate={() => serviceWorker.current?.loadUpdate()}
      onRetryProfile={() => {
        dispatch({ type: 'profile-loaded', state: { status: 'loading' } });
        setProfileAttempt((attempt) => attempt + 1);
      }}
    />
  );
}
