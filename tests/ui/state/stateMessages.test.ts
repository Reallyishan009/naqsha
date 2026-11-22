import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN, HI } from '../../../src/ui/i18n/messages.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');

/** Every state-message key in the design table (empty, loading and error states, R11.1). */
export const STATE_MESSAGE_KEYS: readonly string[] = [
  // Empty states
  'keep.list.empty',
  'keep.list.empty.next',
  'scan.batch.empty',
  'scan.batch.empty.next',
  'codeview.empty',
  // Loading states
  'status.loading',
  'status.screen',
  // Card_Profile failed
  'error.profile.banner',
  'error.profile.fetch-failed',
  'error.profile.not-json',
  'error.profile.invalid-profile',
  // Screen failed to load
  'error.codeview.load',
  'error.generic',
  // Card cannot be read
  'error.read.invalid-profile',
  'error.read.invalid-image',
  'error.read.peg-holes-not-found',
  'error.read.ambiguous-orientation',
  'error.read.resolution-too-low',
  'error.read.card-outside-image',
  // Archive failure
  'error.archive.not-found',
  'error.archive.storage-unavailable',
  'error.archive.write-failed',
];

/** The keys this pass added to both translation files (R11.7). */
export const ADDED_KEYS: readonly string[] = [
  'notice.information',
  'notice.success',
  'notice.warning',
  'notice.error',
  'progress.reading',
  'progress.exporting',
  'progress.saving',
  'theme.label',
  'theme.on',
  'theme.off',
  'disclosure.more',
  'disclosure.settings',
  'state.retry',
  'status.screen',
  'keep.list.empty.next',
  'scan.batch.empty.next',
  'nav.advanced',
  'landing.headline',
  'landing.step.scan',
  'landing.step.weave',
  'landing.step.keep',
  'landing.steps.name',
  'landing.tile.try',
  'landing.scanLink',
  'weave.purpose',
  'weave.nextStep',
  'keep.purpose',
  'keep.nextStep',
  'scan.purpose',
  'scan.nextStep',
  'codeview.purpose',
  'codeview.nextStep',
  'card.title',
  'card.desc',
  'card.damaged',
  'card.missing',
  'card.mismatch',
  'card.cannotDraw',
  'hero.title',
  'hero.desc',
  'hero.desc.plain',
  'codeview.diff.separator',
  'codeview.diff.duplicate',
  'codeview.diff.ellipsis',
  'keep.list.picks.one',
  'keep.list.picks.other',
  'codeview.pickCount.one',
  'codeview.pickCount.other',
  'codeview.diff.option.one',
  'codeview.diff.option.other',
  'repair.evidence.repeat.one',
  'repair.evidence.repeat.other',
  'photo.loomHero.alt',
  'photo.sariPatternCards.alt',
  'photo.kanchipuramHandloom.alt',
  'photo.bradfordCardChain.alt',
  'photo.bradfordCardStack.alt',
  'art.cardDiamond.alt',
  'art.cardBorder.alt',
  'art.cardFloral.alt',
  'art.gridDiamond.alt',
  'art.clothDiamond.alt',
  'art.clothBorder.alt',
  'art.clothFloral.alt',
  'art.clothLost.alt',
  'art.chain8.alt',
  'credits.photos.heading',
  'credits.photos.item',
  'credits.photos.source',
  'credits.photos.change',
  'processLoop.title',
  'processLoop.desc',
  'processLoop.desc.still',
  'processLoop.pause',
  'processLoop.play',
  'nav.menu',
  'nav.scanCard',
  'landing.eyebrow',
  'landing.headline.accent',
  'landing.lead',
  'landing.trySample',
  'landing.facts.name',
  'landing.fact.uploads.value',
  'landing.fact.uploads.label',
  'landing.fact.offline.value',
  'landing.fact.offline.label',
  'landing.fact.picks.label',
  'landing.samples.name',
  'landing.how.eyebrow',
  'landing.how.heading',
  'landing.how.heading.accent',
  'landing.how.subtitle',
  'landing.how.card.title',
  'landing.how.card.text',
  'landing.how.card.chip.holes',
  'landing.how.card.chip.pick',
  'landing.how.pattern.title',
  'landing.how.pattern.text',
  'landing.how.pattern.chip.dark',
  'landing.how.pattern.chip.pale',
  'landing.how.cloth.title',
  'landing.how.cloth.text',
  'landing.how.cloth.chip.pick',
  'landing.how.cloth.chip.colours',
  'landing.can.eyebrow',
  'landing.can.heading',
  'landing.can.heading.accent',
  'landing.can.subtitle',
  'landing.can.read.title',
  'landing.can.read.text',
  'landing.can.read.chip',
  'landing.can.read.action',
  'landing.can.weave.title',
  'landing.can.weave.text',
  'landing.can.weave.action',
  'landing.can.export.title',
  'landing.can.export.text',
  'landing.can.export.chip.one',
  'landing.can.export.chip.eight',
  'landing.can.export.action',
  'landing.can.keep.title',
  'landing.can.keep.text',
  'landing.can.keep.chip',
  'landing.can.keep.action',
  'landing.can.code.title',
  'landing.can.code.text',
  'landing.can.code.action',
  'landing.can.repair.title',
  'landing.can.repair.text',
  'landing.can.repair.chip',
  'landing.can.repair.action',
  'landing.can.offline.title',
  'landing.can.offline.text',
  'landing.can.offline.chip',
  'landing.try.eyebrow',
  'landing.try.heading',
  'landing.try.heading.accent',
  'landing.try.subtitle',
  'landing.sample.diamond',
  'landing.sample.border',
  'landing.sample.floral',
  'landing.tile.try.name',
  'landing.sample.ends.one',
  'landing.sample.ends.other',
  'landing.night.eyebrow',
  'landing.night.heading',
  'landing.night.heading.accent',
  'landing.night.text',
  'landing.night.action',
  'landing.night.actionBack',
  'landing.band.heading',
  'landing.band.heading.accent',
  'landing.band.text',
  'landing.band.privacy',
  'landing.footer.line',
  'landing.footer.links',
  'landing.footer.licence',
  'landing.footer.github',
  'landing.footer.built',
  'landing.footer.fonts.heading',
  'landing.footer.fonts.item',
  'theme.toNight',
  'theme.toDay',
  'language.short.en',
  'language.short.hi',
];

/** The purpose and next-step key of each of the four screens (R10.1). */
export const INTRO_KEYS: readonly string[] = ['weave', 'keep', 'scan', 'codeview'].flatMap((screen) => [
  `${screen}.purpose`,
  `${screen}.nextStep`,
]);

const FORBIDDEN_WORDS = /bitmap|matrix|decode|decoded|decoding/i;

/** Sentences end at . ! ? or the Devanagari danda followed by a space or the end of the text. */
function sentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?\u0964])\s+/u)
    .filter((part) => part.length > 0);
}

function characters(text: string): number {
  return [...text].length;
}

function english(key: string): string {
  const text = EN[key];
  if (text === undefined) throw new Error(`en.json has no key "${key}"`);
  return text;
}

describe('state messages (R11)', () => {
  it('R11.1 the named list names each state-message key once', () => {
    expect(new Set(STATE_MESSAGE_KEYS).size).toBe(STATE_MESSAGE_KEYS.length);
    expect(STATE_MESSAGE_KEYS.length).toBeGreaterThan(0);
  });

  it.each(STATE_MESSAGE_KEYS)('R11.3 %s is at most 160 characters and one to three sentences', (key) => {
    const text = english(key);
    expect(characters(text)).toBeLessThanOrEqual(160);
    const count = sentences(text).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  it.each(STATE_MESSAGE_KEYS)('R11.2 %s avoids bitmap, matrix, decode, decoded and decoding', (key) => {
    // The Code view may use its own words; no message here does, so the check is applied to every key.
    expect(english(key)).not.toMatch(FORBIDDEN_WORDS);
  });

  it.each(STATE_MESSAGE_KEYS)('R11.6 %s is in both files', (key) => {
    expect(Object.hasOwn(EN, key)).toBe(true);
    expect(Object.hasOwn(HI, key)).toBe(true);
    expect(HI[key]?.text.trim().length).toBeGreaterThan(0);
  });
});

describe('intro lines (R10.1)', () => {
  it('R10.1 the eight intro keys are the purpose and next step of weave, keep, scan and codeview', () => {
    expect(INTRO_KEYS).toHaveLength(8);
  });

  it.each(INTRO_KEYS)('R10.1 %s is one sentence of at most 100 characters in English and in Hindi', (key) => {
    const texts = { en: english(key), hi: HI[key]?.text ?? '' };
    for (const [language, text] of Object.entries(texts)) {
      expect(text.length, `${key} (${language}) is missing`).toBeGreaterThan(0);
      expect(characters(text), `${key} (${language}) is too long`).toBeLessThanOrEqual(100);
      expect(sentences(text), `${key} (${language}) is not one sentence`).toHaveLength(1);
    }
  });
});

describe('translation files (R11.6 to R11.8)', () => {
  it('R11.8 en.json and hi.json have the same set of keys', () => {
    const enKeys = Object.keys(EN).sort();
    const hiKeys = Object.keys(HI).sort();
    expect(hiKeys.filter((key) => !Object.hasOwn(EN, key))).toEqual([]);
    expect(enKeys.filter((key) => !Object.hasOwn(HI, key))).toEqual([]);
    expect(hiKeys).toEqual(enKeys);
  });

  it.each(ADDED_KEYS)('R11.6 %s is in both files', (key) => {
    expect(Object.hasOwn(EN, key)).toBe(true);
    expect(Object.hasOwn(HI, key)).toBe(true);
  });

  it.each(ADDED_KEYS)('R11.7 %s has "reviewed": false in hi.json and is listed in HINDI_REVIEW.md', (key) => {
    expect(HI[key]?.reviewed).toBe(false);
    const review = readFileSync(path.join(ROOT, 'docs/HINDI_REVIEW.md'), 'utf8');
    expect(review).toContain(`| \`${key}\` |`);
  });
});
