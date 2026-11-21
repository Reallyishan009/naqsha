import { describe, expect, it } from 'vitest';
import {
  SCREENSHOT_THEMES,
  SCREENSHOT_VIEWS,
  SCREENSHOT_WIDTHS,
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
