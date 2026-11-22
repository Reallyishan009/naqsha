import type { ThemeName } from '../theme/contrast.ts';
import { THEME_STORAGE_KEY } from '../theme/theme.ts';
import type { Language } from '../types.ts';

export const LANGUAGE_STORAGE_KEY = 'naqsha.language';

/** The part of Storage the app uses. A fake in tests. */
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function isLanguage(value: unknown): value is Language {
  return value === 'hi' || value === 'en';
}

/** The stored language, or null when nothing valid is stored or the storage fails. Never throws. */
export function readStoredLanguage(storage: KeyValueStorage | null): Language | null {
  if (storage === null) return null;
  try {
    const value = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** Stores the language. Returns false when the storage refuses; the app carries on. Never throws. */
export function storeLanguage(storage: KeyValueStorage | null, language: Language): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
    return true;
  } catch {
    return false;
  }
}

function isThemeName(value: unknown): value is ThemeName {
  return value === 'day' || value === 'night';
}

/** The stored theme, or null when nothing valid is stored or the storage fails. Never throws. */
export function readStoredTheme(storage: KeyValueStorage | null): ThemeName | null {
  if (storage === null) return null;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isThemeName(value) ? value : null;
  } catch {
    return null;
  }
}

/** Stores the theme. Returns false when the storage refuses; the app carries on. Never throws. */
export function storeTheme(storage: KeyValueStorage | null, theme: ThemeName): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Reads `prefers-color-scheme: dark` once. False when matchMedia is missing or throws. */
export function browserPrefersDark(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Playback starts by itself exactly when the user has not asked for reduced motion (R14.8, R14.9). */
export function autoplay(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/** What the page can say about the camera (R18.1, R18.6). */
export type CameraEnv = { isSecureContext: boolean; hasGetUserMedia: boolean };

/**
 * `shown`: offer the live camera control. `hidden-with-note`: the page is not secure, so hide it and say why.
 * `hidden`: the page is secure but the browser has no getUserMedia, so hide it without a note.
 */
export type CameraControl = 'shown' | 'hidden-with-note' | 'hidden';

export function cameraControl(env: CameraEnv): CameraControl {
  if (!env.isSecureContext) return 'hidden-with-note';
  return env.hasGetUserMedia ? 'shown' : 'hidden';
}

/** The browser's localStorage, or null when it is missing or blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads `prefers-reduced-motion: reduce` once. False when matchMedia is missing. */
export function browserPrefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Sets the `lang` attribute of the document element. */
export function setDocumentLanguage(language: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

/**
 * Fetches one of the app's own static demo images (a GET of a file served with the app; nothing of the user's is sent).
 * It lives here with the other browser calls so the Scan screen's sources hold no network call (R13.1).
 */
export function fetchDemoImageFile(demoImageUrl: string): Promise<Response> {
  return fetch(demoImageUrl);
}

/** Whether the browser thinks it is online. True when the browser cannot say. */
export function browserIsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
