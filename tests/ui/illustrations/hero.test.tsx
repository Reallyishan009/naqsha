import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile, Pattern } from '../../../src/codec/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { HeroLoom } from '../../../src/ui/illustrations/HeroLoom.tsx';
import { heroPose } from '../../../src/ui/illustrations/heroPose.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { Landing } from '../../../src/ui/screens/weave/Landing.tsx';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import { demoProfile } from '../../support/profiles.ts';

const ILLUSTRATIONS = path.resolve(import.meta.dirname, '../../../src/ui/illustrations');
const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');
const profile = demoProfile();
const pattern = generateSample(profile, 'diamond');

function render(forPattern: Pattern, reducedMotion = false, t = en, forProfile: CardProfile = profile): string {
  return renderToStaticMarkup(<HeroLoom profile={forProfile} pattern={forPattern} reducedMotion={reducedMotion} t={t} />);
}

/** The ends whose group holds a raised hook, and the ends whose group holds a lifted end, read from the markup. */
function raisedAndLifted(html: string): { raised: number[]; lifted: number[] } {
  const raised: number[] = [];
  const lifted: number[] = [];
  for (const match of html.matchAll(/<g data-end="(\d+)">(.*?)<\/g>/g)) {
    const end = Number(match[1]);
    const inner = match[2] ?? '';
    for (const line of inner.matchAll(/<line class="([^"]*)"/g)) {
      if ((line[1] ?? '').includes('hookRaised')) raised.push(end);
      if ((line[1] ?? '').includes('endLifted')) lifted.push(end);
    }
  }
  return { raised, lifted };
}

/** How many elements carry the CSS Module class `name`, whatever prefix or hash the build adds to it. */
function classCount(html: string, name: string): number {
  const own = new RegExp(`(^|[_\\s])${name}([_\\s]|$)`);
  return [...html.matchAll(/class="([^"]*)"/g)].filter((match) => own.test(match[1] ?? '')).length;
}

function blankPattern(): Pattern {
  const blank: CardGrid = Array.from({ length: profile.hookRows }, () => Array.from({ length: profile.hookColumns }, () => false));
  return [blank, blank];
}

describe('HeroLoom', () => {
  it('R13.2 the raised hooks and the lifted ends each equal the punched count of the chosen pick, at the encoded ends', () => {
    const pose = heroPose(profile, pattern);
    expect(pose.kind).toBe('lifted');
    if (pose.kind !== 'lifted') return;
    const punched = pose.grid.flat().filter(Boolean).length;
    expect(punched).toBeGreaterThan(0);
    const { raised, lifted } = raisedAndLifted(render(pattern));
    expect(raised).toHaveLength(punched);
    expect(lifted).toHaveLength(punched);
    expect(raised).toEqual(pose.liftedEnds);
    expect(lifted).toEqual(pose.liftedEnds);
  });

  it('R13.1 the drawing holds the head, the card, a needle, a hook and a warp end for every end, and one weft', () => {
    const html = render(pattern);
    const ends = profile.hookRows * profile.hookColumns;
    expect(classCount(html, 'needle')).toBe(ends);
    expect(classCount(html, 'hook') + classCount(html, 'hookRaised')).toBe(ends);
    expect(classCount(html, 'end') + classCount(html, 'endLifted')).toBe(ends);
    expect(classCount(html, 'weft')).toBe(1);
    expect(classCount(html, 'head')).toBe(1);
    expect(classCount(html, 'stock')).toBe(1);
  });

  it('R13.10 the plain pose draws no raised hook and no lifted end, and does not throw', () => {
    const html = render(blankPattern());
    expect(html).toContain('data-pose="plain"');
    expect(raisedAndLifted(html)).toEqual({ raised: [], lifted: [] });
    expect(html).not.toContain('hookRaised');
    expect(html).not.toContain('endLifted');
    expect(() => render([])).not.toThrow();
    expect(html).toContain(en('hero.desc.plain'));
  });

  it('R13.10 an invalid profile draws nothing and does not throw', () => {
    const invalid = { ...profile, hookRows: 0 } as CardProfile;
    expect(render(pattern, false, en, invalid)).toBe('');
  });

  it('R13.4 R23.4 reduced motion sets data-motion="still", and otherwise it is "play"', () => {
    expect(render(pattern, true)).toContain('data-motion="still"');
    expect(render(pattern, false)).toContain('data-motion="play"');
  });

  it('R13.5 the title and the description are in the current language and say the pose', () => {
    const english = render(pattern, false, en);
    const hindi = render(pattern, false, hi);
    const lifted = String(raisedAndLifted(english).lifted.length);
    expect(english).toContain(`<title id="`);
    expect(english).toContain(en('hero.title'));
    expect(english).toContain(en('hero.desc', { lifted }));
    expect(hindi).toContain(hi('hero.title'));
    expect(hindi).toContain(hi('hero.desc', { lifted }));
    expect(hi('hero.title')).not.toBe(en('hero.title'));
    expect(english).toMatch(/role="img" aria-labelledby="(\S+) (\S+)"/);
    const [, titleId, descId] = /aria-labelledby="(\S+) (\S+)"/.exec(english) ?? [];
    expect(english).toContain(`<title id="${titleId}">`);
    expect(english).toContain(`<desc id="${descId}">`);
    for (const word of ['Jacquard head', 'card', 'warp ends']) expect(en('hero.desc')).toContain(word);
  });

  it('R13.3 R13.4 one animation set with one iteration, 1,920 ms from the motion token, and none under reduced motion', () => {
    const css = readFileSync(path.join(ILLUSTRATIONS, 'HeroLoom.module.css'), 'utf8');
    expect(css).toContain('animation-iteration-count: 1;');
    expect(css).not.toContain('infinite');
    expect([...css.matchAll(/animation-iteration-count:\s*([^;]+);/g)].map((match) => match[1])).toEqual(['1']);
    expect(css).toContain('animation-duration: calc(var(--motion-long) * 6);');
    const tokens = readFileSync(path.resolve(ILLUSTRATIONS, '../theme/tokens.css'), 'utf8');
    const long = Number(/--motion-long:\s*(\d+)ms/.exec(tokens)?.[1]);
    expect(long * 6).toBeLessThanOrEqual(3000);
    // The animations play only while data-motion is "play"; the still pose is the lifted pose.
    expect(css).toContain(".hero[data-motion='still']");
    expect(css).toContain('--still-lift: var(--lift)');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
    expect(css).toContain('translateY(calc(var(--still-lift, 0px) * -1))');
  });

  it('R13.7 a raised hook and a lifted end differ from the resting ones by position and by colour', () => {
    const css = readFileSync(path.join(ILLUSTRATIONS, 'HeroLoom.module.css'), 'utf8');
    expect(css).toMatch(/\.hook,\s*\.end\s*\{[^}]*stroke:\s*var\(--indigo\)/);
    expect(css).toMatch(/\.hookRaised,\s*\.endLifted\s*\{[^}]*stroke:\s*var\(--zari\)[^}]*transform:\s*translateY/);
    expect(css).toMatch(/translateY\(calc\(var\(--lift\) \* -1\)\)/);
    const html = render(pattern);
    expect(html).toContain('--lift:30px');
  });

  it('R13.1 R13.8 the source has no colour literal, gradient, filter, image or emoji, and the picture scales', () => {
    const tsx = readFileSync(path.join(ILLUSTRATIONS, 'HeroLoom.tsx'), 'utf8');
    const css = readFileSync(path.join(ILLUSTRATIONS, 'HeroLoom.module.css'), 'utf8');
    for (const source of [tsx, css]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
      expect(source).not.toMatch(/Gradient|<filter|filter:|<image|url\(['"]?http|\p{Extended_Pictographic}/u);
    }
    expect(css).toMatch(/\.hero\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/);
    expect(render(pattern)).toMatch(/viewBox="0 0 \d+ \d+"/);
  });
});

describe('Landing hero slot', () => {
  const state = { ...initialAppState, profile: { status: 'ready', profile } } as typeof initialAppState;
  // The slot holds the Process_Loop (which runs the Hero_Loom's pose logic) since the second design pass; the checks keep their aim:
  // the slot is there from the first paint, holds the first Sample_Design drawn with nothing to focus but its pause control,
  // is empty with no profile, and follows the reduced motion setting.
  it('R13.1 the slot holds the live loom picture of the first Sample_Design, with a name and nothing to focus but its pause button', () => {
    const html = renderToStaticMarkup(<Landing state={state} dispatch={() => undefined} t={en} />);
    const slot = /<div class="[^"]*mediaSlot[^"]*" data-hero-slot=""[^>]*>(.*?)<\/figure><\/div><\/div>/s.exec(html);
    expect(slot).not.toBeNull();
    expect(slot?.[1]).toContain('data-process-loop=""');
    expect(slot?.[1]).toMatch(/<canvas\b[^>]*role="img"[^>]*aria-labelledby="processTitle/);
    expect(slot?.[1]).toContain(en('processLoop.title'));
    const focusable = [...(slot?.[0] ?? '').matchAll(/<(a|button|input)\b[^>]*>(.*?)<\/\1>|tabindex/g)];
    expect(focusable.map((match) => match[2])).toEqual([en('processLoop.pause')]);
    // The first Sample_Design is Diamond: the picture woves its first picks (at most MAX_SHOWN_PICKS of them).
    const picks = generateSample(profile, 'diamond').length;
    expect(slot?.[1]).toContain(en('processLoop.desc', { picks: Math.min(picks, 20) }));
  });

  it('R13.1 with no profile the slot is empty, and it follows the reduced motion setting', () => {
    const empty = renderToStaticMarkup(<Landing state={initialAppState} dispatch={() => undefined} t={en} />);
    expect(empty).toMatch(/data-hero-slot=""[^>]*><div class="[^"]*mediaCard[^"]*"><\/div><\/div>/);
    const still = renderToStaticMarkup(<Landing state={{ ...state, prefersReducedMotion: true }} dispatch={() => undefined} t={en} />);
    expect(still).toContain('data-motion="still"');
  });
});
