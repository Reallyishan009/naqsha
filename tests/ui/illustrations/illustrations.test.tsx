import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NoCardsScannedIllustration, NoSavedDesignsIllustration, NothingToCompareIllustration, WorksOfflineIllustration } from '../../../src/ui/illustrations/SpotIllustrations.tsx';
import { KeepStepIcon, ScanStepIcon, WeaveStepIcon } from '../../../src/ui/illustrations/StepIcons.tsx';
import { STROKE } from '../../../src/ui/illustrations/strokes.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { Landing } from '../../../src/ui/screens/weave/Landing.tsx';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import { StateMessage } from '../../../src/ui/components/StateMessage.tsx';
import { demoProfile } from '../../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const ILLUSTRATIONS = path.join(ROOT, 'src/ui/illustrations');
const SOURCES = ['Drawing.tsx', 'StepIcons.tsx', 'SpotIllustrations.tsx', 'strokes.ts', 'Drawings.module.css'];
/** The commit that held the repository before this pass began. */
const STAGE_0 = '63578cf';
const en = translator(DICTIONARIES, 'en');

const STEP_ICONS = [ScanStepIcon, WeaveStepIcon, KeepStepIcon];
const SPOTS = [NoSavedDesignsIllustration, NoCardsScannedIllustration, NothingToCompareIllustration, WorksOfflineIllustration];
const html = (draw: (props: { decorative?: true }) => ReactElement) => renderToStaticMarkup(draw({}));

describe('Step_Icons and Spot_Illustrations', () => {
  it('R14.1 the three Step_Icons draw different content', () => {
    expect(new Set(STEP_ICONS.map(html)).size).toBe(3);
  });
  it('R14.2 the Spot_Illustrations (the three of the empty states and the Works offline drawing) draw different content', () => {
    expect(new Set(SPOTS.map(html)).size).toBe(SPOTS.length);
  });
  it('R14.9 each has a viewBox, no fixed width or height attribute and is hidden from assistive technology', () => {
    for (const draw of [...STEP_ICONS, ...SPOTS]) {
      const markup = html(draw);
      expect(markup).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(markup).not.toMatch(/<svg[^>]* (width|height)=/);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).not.toContain('<title');
    }
  });
  it('R14.6 the non-decorative form has role="img", a title and a description', () => {
    const markup = renderToStaticMarkup(<ScanStepIcon decorative={false} title="Scan" desc="A card inside corner brackets" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-labelledby=');
    expect(markup).toMatch(/<title[^>]*>Scan<\/title>/);
    expect(markup).toMatch(/<desc[^>]*>A card inside corner brackets<\/desc>/);
    expect(markup).not.toContain('aria-hidden');
  });
  it('R14.4 R14.8 R23.8 the sources have no colour literal, gradient, filter, blur or emoji', () => {
    for (const name of SOURCES) {
      const source = readFileSync(path.join(ILLUSTRATIONS, name), 'utf8');
      expect(source, `${name} hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, `${name} rgb or hsl`).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i);
      expect(source, `${name} gradient`).not.toMatch(/gradient/i);
      expect(source, `${name} filter`).not.toMatch(/<filter\b|\bfilter\s*[=:]/);
      expect(source, `${name} blur`).not.toMatch(/blur\(|backdrop-?filter/i);
      expect(source, `${name} emoji`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it('R14.4 every stroke width in the drawings comes from the shared STROKE constant', () => {
    for (const name of ['StepIcons.tsx', 'SpotIllustrations.tsx']) {
      const source = readFileSync(path.join(ILLUSTRATIONS, name), 'utf8');
      expect(source, name).not.toMatch(/strokeWidth="/);
      for (const match of source.matchAll(/strokeWidth=\{([^}]*)\}/g)) expect(match[1], name).toMatch(/^STROKE\.(line|fine)$/);
    }
    expect(STROKE.fine).toBeLessThan(STROKE.line);
  });
  it('R14.3 the Landing draws one Spot_Illustration, in its Works offline card, and no Step_Icon; each How it works step has its number', () => {
    const state = { ...initialAppState, profile: { status: 'ready' as const, profile: demoProfile() } };
    const markup = renderToStaticMarkup(<Landing state={state} dispatch={() => undefined} t={en} />);
    expect([...markup.matchAll(/data-drawing="(spot-[a-z-]+)"/g)].map((match) => match[1])).toEqual(['spot-works-offline']);
    expect(markup).not.toMatch(/data-drawing="step-/);
    const list = /<ol [^>]*>(.*?)<\/ol>/s.exec(markup)?.[1] ?? '';
    const items = [...list.matchAll(/<li [^>]*data-step="[a-z]+"[^>]*>(.*?)<\/h4>/gs)].map((match) => match[1] ?? '');
    expect(items).toHaveLength(3);
    expect(items.map((item) => /<span class="[^"]*badge[^"]*" aria-hidden="true">(\d)<\/span>/.exec(item)?.[1])).toEqual(['1', '2', '3']);
  });
  it('R14.3 an empty state shows the Spot_Illustration beside its message and next step', () => {
    for (const Spot of SPOTS) {
      const markup = renderToStaticMarkup(
        <StateMessage variant="empty" illustration={<Spot />} message="Nothing here." next="Do this next." t={en} />,
      );
      expect(markup).toContain('<svg');
      expect(markup).toContain('Nothing here.');
      expect(markup).toContain('Do this next.');
    }
  });
  it('R14.7 this pass added no image or font file for an illustration, and package.json has the Stage 0 dependencies', () => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    const added = [
      ...git('diff', '--name-only', '--diff-filter=A', STAGE_0, '--', 'src', 'public').split('\n'),
      ...git('ls-files', '--others', '--exclude-standard', '--', 'src', 'public').split('\n'),
    ].filter((file) => file !== '' && !file.startsWith('public/fonts/') && !file.startsWith('public/demo/')); // public/demo/ holds the judges' demo files (images and BMPs for testing, not illustrations); everything else stays strict
    expect(added.filter((file) => /\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i.test(file))).toEqual([]);
    const before = JSON.parse(git('show', `${STAGE_0}:package.json`)) as Record<string, unknown>;
    const now = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(now.dependencies).toEqual(before.dependencies);
    expect(now.devDependencies).toEqual(before.devDependencies);
  });
});
