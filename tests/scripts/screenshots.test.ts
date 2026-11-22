import { describe, expect, it } from 'vitest';
import {
  LANDING_FULL_FOLDER,
  LANDING_FULL_WIDTHS,
  SCREENSHOT_THEMES,
  SCREENSHOT_VIEWS,
  SCREENSHOT_WIDTHS,
  landingFullNames,
  landingFullProblems,
  RUN2_FOLDER,
  RUN2_VIEWS,
  run2Names,
  run2Problems,
  screenshotNames,
  setProblems,
} from '../../scripts/checks/screenshots.ts';

/** The smallest PNG head the checks read: the signature, then an IHDR chunk with the given width. */
function pngOfWidth(width: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12); // IHDR
  view.setUint32(16, width);
  view.setUint32(20, 800);
  return bytes;
}

function validSet(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const name of screenshotNames()) files.set(name, pngOfWidth(Number(/-(\d+)\.png$/.exec(name)![1])));
  return files;
}

describe('screenshot helpers', () => {
  it('R24.3 the lists hold the six views, two themes and two widths', () => {
    expect([...SCREENSHOT_VIEWS]).toEqual(['weave-landing', 'weave-sample', 'weave-lost', 'keep-versions', 'scan', 'code-diff']);
    expect([...SCREENSHOT_THEMES]).toEqual(['day', 'night']);
    expect([...SCREENSHOT_WIDTHS]).toEqual([320, 1280]);
  });

  it('R24.3 screenshotNames gives the 24 names in view, theme, width order', () => {
    const names = screenshotNames();
    expect(names).toHaveLength(24);
    expect(names.slice(0, 5)).toEqual([
      'weave-landing-day-320.png',
      'weave-landing-day-1280.png',
      'weave-landing-night-320.png',
      'weave-landing-night-1280.png',
      'weave-sample-day-320.png',
    ]);
    expect(names[23]).toBe('code-diff-night-1280.png');
    expect(new Set(names).size).toBe(24);
  });

  it('R24.10 a valid set of 24 files has no problem', () => {
    expect(setProblems(validSet())).toEqual([]);
  });

  it('R24.10 a missing file is named', () => {
    const files = validSet();
    files.delete('scan-night-320.png');
    expect(setProblems(files)).toEqual(['scan-night-320.png is missing']);
  });

  it('R24.10 an extra file is named', () => {
    const files = validSet();
    files.set('extra-day-320.png', pngOfWidth(320));
    expect(setProblems(files)).toEqual(['extra-day-320.png is not one of the 24 screenshot names']);
  });

  it('R24.11 a file that is not a PNG is named', () => {
    const files = validSet();
    files.set('keep-versions-day-1280.png', new TextEncoder().encode('this is not a picture at all, just text'));
    expect(setProblems(files)).toEqual(['keep-versions-day-1280.png is not a PNG file']);
  });

  it('R24.11 a file whose width differs from its name is named', () => {
    const files = validSet();
    files.set('code-diff-day-320.png', pngOfWidth(1280));
    expect(setProblems(files)).toEqual(['code-diff-day-320.png is 1280 pixels wide, expected 320']);
  });
});

function validLandingFullSet(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const name of landingFullNames()) files.set(name, pngOfWidth(Number(/-(\d+)\.png$/.exec(name)![1])));
  return files;
}

describe('full-page Landing screenshot set', () => {
  it('the set goes to its own folder, media/design/after-run1, apart from the 24-file sets', () => {
    expect(LANDING_FULL_FOLDER).toBe('after-run1');
    expect([...LANDING_FULL_WIDTHS]).toEqual([390, 1280]);
  });

  it('landingFullNames gives exactly the 4 names landing-full-<theme>-<width>.png, theme then width', () => {
    expect(landingFullNames()).toEqual([
      'landing-full-day-390.png',
      'landing-full-day-1280.png',
      'landing-full-night-390.png',
      'landing-full-night-1280.png',
    ]);
  });

  it('a valid set of 4 files has no problem, and none of its names is one of the 24', () => {
    expect(landingFullProblems(validLandingFullSet())).toEqual([]);
    const first = new Set(screenshotNames());
    for (const name of landingFullNames()) expect(first.has(name), name).toBe(false);
  });

  it('a missing file is named', () => {
    const files = validLandingFullSet();
    files.delete('landing-full-night-390.png');
    expect(landingFullProblems(files)).toEqual(['landing-full-night-390.png is missing']);
  });

  it('a fifth file is named, so a set is exactly 4 files', () => {
    const files = validLandingFullSet();
    files.set('landing-full-day-320.png', pngOfWidth(320));
    expect(landingFullProblems(files)).toEqual(['landing-full-day-320.png is not one of the 4 landing-full screenshot names']);
  });

  it('a file that is not a PNG is named', () => {
    const files = validLandingFullSet();
    files.set('landing-full-day-1280.png', new TextEncoder().encode('this is not a picture at all, just text'));
    expect(landingFullProblems(files)).toEqual(['landing-full-day-1280.png is not a PNG file']);
  });

  it('a file whose width differs from its name is named', () => {
    const files = validLandingFullSet();
    files.set('landing-full-night-390.png', pngOfWidth(1280));
    expect(landingFullProblems(files)).toEqual(['landing-full-night-390.png is 1280 pixels wide, expected 390']);
  });

  it('the 24-file check still refuses the 4 landing-full files as extras', () => {
    const files = validSet();
    for (const [name, bytes] of validLandingFullSet()) files.set(name, bytes);
    expect(setProblems(files)).toHaveLength(4);
  });
});

describe('run 2 screenshot set', () => {
  const widthOf = (name: string): number => Number(/-(\d+)\.png$/.exec(name)![1]);

  it('goes to media/design/after-run2 and names each file <view>-<theme>-<width>.png', () => {
    expect(RUN2_FOLDER).toBe('after-run2');
    const names = run2Names();
    expect(names).toContain('header-closed-day-1280.png');
    expect(names).toContain('header-menu-hi-night-320.png');
    expect(new Set(names).size).toBe(names.length);
    // The menu sheet exists only under 1024 px.
    expect(names.filter((name) => name.startsWith('header-menu')).every((name) => widthOf(name) < 1024)).toBe(true);
  });

  it('names the Weave views at 390 and 1280 px, in both themes', () => {
    const names = run2Names(['weave-sample', 'weave-lost']);
    expect(names).toEqual([
      'weave-sample-day-1280.png',
      'weave-sample-day-390.png',
      'weave-sample-night-1280.png',
      'weave-sample-night-390.png',
      'weave-lost-day-1280.png',
      'weave-lost-day-390.png',
      'weave-lost-night-1280.png',
      'weave-lost-night-390.png',
    ]);
  });

  it('names the Keep view at 390 and 1280 px, in both themes', () => {
    expect(run2Names(['keep-versions'])).toEqual([
      'keep-versions-day-1280.png',
      'keep-versions-day-390.png',
      'keep-versions-night-1280.png',
      'keep-versions-night-390.png',
    ]);
  });
  it('run2Names takes the named views only', () => {
    const names = run2Names(['header-menu']);
    expect(names).toHaveLength(2 * RUN2_VIEWS.find((view) => view.name === 'header-menu')!.widths.length);
    expect(names.every((name) => name.startsWith('header-menu-day-') || name.startsWith('header-menu-night-'))).toBe(true);
  });

  it('a complete set has no problem, a missing file, a wrong width, a text file and a stranger are each named', () => {
    const files = new Map<string, Uint8Array>(run2Names().map((name) => [name, pngOfWidth(widthOf(name))]));
    expect(run2Problems(files)).toEqual([]);
    files.delete('header-closed-day-320.png');
    files.set('header-closed-night-390.png', pngOfWidth(391));
    files.set('header-menu-day-768.png', new TextEncoder().encode('this is not a picture at all, just text'));
    files.set('stranger-day-1280.png', pngOfWidth(1280));
    expect(run2Problems(files)).toEqual([
      'header-closed-day-320.png is missing',
      'header-closed-night-390.png is 391 pixels wide, expected 390',
      'header-menu-day-768.png is not a PNG file',
      'stranger-day-1280.png is not one of the run 2 screenshot names',
    ]);
  });

  it('files of the views not asked for are not missing, and a problem of another view is left out', () => {
    const files = new Map<string, Uint8Array>(run2Names(['header-menu']).map((name) => [name, pngOfWidth(widthOf(name))]));
    expect(run2Problems(files, ['header-menu'])).toEqual([]);
    files.set('header-closed-day-1280.png', new TextEncoder().encode('broken'));
    expect(run2Problems(files, ['header-menu'])).toEqual([]);
    expect(run2Problems(files, ['header-closed'])).toContain('header-closed-day-1280.png is not a PNG file');
  });
});
