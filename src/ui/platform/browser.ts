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

/** Playback starts by itself exactly when the user has not asked for reduced motion (R14.8, R14.9). */
export function autoplay(reducedMotion: boolean): boolean {
  return !reducedMotion;
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
