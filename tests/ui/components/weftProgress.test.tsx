import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PROGRESS_DELAY_MS, startDelay } from '../../../src/ui/components/delay.ts';
import type { Timers } from '../../../src/ui/components/delay.ts';
import { WeftProgress } from '../../../src/ui/components/WeftProgress.tsx';
import { DICTIONARIES } from '../../../src/ui/i18n/messages.ts';

const COMPONENTS = path.resolve(import.meta.dirname, '../../../src/ui/components');

type Pending = { handle: number; at: number; callback: () => void };

/** A fake clock: `advance` runs every timer that has come due. */
function fakeClock() {
  let now = 0;
  let next = 1;
  let pending: Pending[] = [];
  const timers: Timers = {
    setTimeout: (callback, ms) => {
      const handle = next++;
      pending.push({ handle, at: now + ms, callback });
      return handle;
    },
    clearTimeout: (handle) => {
      pending = pending.filter((timer) => timer.handle !== handle);
    },
  };
  const advance = (ms: number): void => {
    now += ms;
    const due = pending.filter((timer) => timer.at <= now);
    pending = pending.filter((timer) => timer.at > now);
    for (const timer of due) timer.callback();
  };
  return { timers, advance };
}

describe('WeftProgress', () => {
  it('R7.4 the markup has visible text, a drawn weft on a track in an svg, and no role', () => {
    const markup = renderToStaticMarkup(<WeftProgress text="Reading the card…" />);
    expect(markup).toContain('Reading the card…');
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(markup).toContain('track');
    expect(markup).toContain('weft');
    expect(markup).not.toContain('role=');
  });

  it('R7.4 the progress texts exist in both languages', () => {
    for (const key of ['progress.reading', 'progress.exporting', 'progress.saving']) {
      expect(DICTIONARIES.en[key]?.length, `en ${key}`).toBeGreaterThan(0);
      expect(DICTIONARIES.hi[key]?.text.length, `hi ${key}`).toBeGreaterThan(0);
    }
  });

  it('R7.5 the delay is 300 ms, and startDelay fires once at 300 ms and not at 299 ms', () => {
    expect(PROGRESS_DELAY_MS).toBe(300);
    const { timers, advance } = fakeClock();
    let fired = 0;
    startDelay(PROGRESS_DELAY_MS, () => (fired += 1), timers);
    advance(299);
    expect(fired).toBe(0);
    advance(1);
    expect(fired).toBe(1);
    advance(1000);
    expect(fired).toBe(1);
  });

  it('R7.5 a cancelled startDelay never fires, and cancelling twice is harmless', () => {
    const { timers, advance } = fakeClock();
    let fired = 0;
    const cancel = startDelay(300, () => (fired += 1), timers);
    advance(100);
    cancel();
    cancel();
    advance(1000);
    expect(fired).toBe(0);
  });

  it('R23.4 the module has no animation outside a motion token and a reduced-motion rule that stops it', () => {
    const source = readFileSync(path.join(COMPONENTS, 'WeftProgress.module.css'), 'utf8');
    const animations = [...source.matchAll(/animation\s*:\s*([^;]+);/g)].map((match) => match[1]!);
    expect(animations.length).toBeGreaterThan(0);
    for (const value of animations) {
      if (value.trim() === 'none') continue;
      expect(value).toMatch(/calc\(var\(--motion-long\) \* 4\)/);
      expect(value).not.toMatch(/\d+m?s\b/);
    }
    expect(source).toMatch(/prefers-reduced-motion: reduce\)\s*{[^}]*animation: none/);
  });
});
