import type { SimFailure } from '../../simulator/index.ts';
import type { Dictionaries, Dictionary, HiDictionary, Language, PrintFailure, ProfileFailure } from '../types.ts';
import enJson from './en.json';
import hiJson from './hi.json';

export const EN: Dictionary = enJson;
export const HI: HiDictionary = hiJson;
export const DICTIONARIES: Dictionaries = { en: EN, hi: HI };

type PartialDictionaries = { en: Readonly<Record<string, string>>; hi: Readonly<Record<string, { text: string }>> };

/** The text for key in language, else the en text, else the key itself (R12.7). */
export function lookup(dictionaries: PartialDictionaries, language: Language, key: string): string {
  if (language === 'hi') {
    const entry = Object.hasOwn(dictionaries.hi, key) ? dictionaries.hi[key] : undefined;
    if (entry !== undefined) return entry.text;
  }
  return Object.hasOwn(dictionaries.en, key) ? (dictionaries.en[key] as string) : key;
}

/** The names of the {name} placeholders in a text. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string);
}

/** Replaces each {name} with params[name]; a name without a value stays as written. */
export function fillPlaceholders(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

export type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

/** t(key, params) for one language. */
export function translator(dictionaries: PartialDictionaries, language: Language): Translate {
  return (key, params) => fillPlaceholders(lookup(dictionaries, language, key), params);
}

export function simFailureKey(failure: SimFailure): string {
  switch (failure.reason) {
    case 'invalid-profile':
      return 'error.sim.invalid-profile';
    case 'invalid-settings':
      return 'error.sim.invalid-settings';
    case 'pick-out-of-range':
      return 'error.sim.pick-out-of-range';
    default: {
      const unreachable: never = failure;
      return unreachable;
    }
  }
}

export function profileFailureKey(failure: ProfileFailure): string {
  switch (failure.reason) {
    case 'fetch-failed':
      return 'error.profile.fetch-failed';
    case 'not-json':
      return 'error.profile.not-json';
    case 'invalid-profile':
      return 'error.profile.invalid-profile';
    default: {
      const unreachable: never = failure;
      return unreachable;
    }
  }
}

export function printFailureKey(failure: PrintFailure): string {
  switch (failure.reason) {
    case 'invalid-card':
      return 'error.print.invalid-card';
    default: {
      const unreachable: never = failure.reason;
      return unreachable;
    }
  }
}
