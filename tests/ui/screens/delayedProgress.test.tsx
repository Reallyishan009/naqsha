import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROGRESS_DELAY_MS, startDelay } from '../../../src/ui/components/delay.ts';
import type { Timers } from '../../../src/ui/components/delay.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { KeepView } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { ScanView } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import { initialKeepForm } from '../../../src/ui/state/keep.ts';
import { initialScanState } from '../../../src/ui/state/scan.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { demoProfile } from '../../support/profiles.ts';

/**
 * The views are rendered on the server, where effects never run, so the real `useAfterDelay` always answers false.
 * Each view takes the rule as `afterDelay`; here it is the same rule driven by a fake clock and the real `startDelay`:
 * one timer per slot, started when the operation becomes active and cancelled when it ends. Each render of a view asks
 * the slots in the same order.
 */
type Slot = { active: boolean; elapsed: boolean; cancel: (() => void) | null };
type Pending = { handle: number; at: number; callback: () => void };
const clock = { now: 0, next: 1, pending: [] as Pending[], slots: [] as Slot[], cursor: 0 };

const timers: Timers = {
  setTimeout: (callback, ms) => {
    const handle = clock.next++;
    clock.pending.push({ handle, at: clock.now + ms, callback });
    return handle;
  },
  clearTimeout: (handle) => {
    clock.pending = clock.pending.filter((timer) => timer.handle !== handle);
  },
};

function afterDelay(active: boolean): boolean {
  const slot = (clock.slots[clock.cursor] ??= { active: false, elapsed: false, cancel: null });
  clock.cursor += 1;
  if (active && !slot.active) {
    slot.cancel = startDelay(PROGRESS_DELAY_MS, () => (slot.elapsed = true), timers);
  }
  if (!active && slot.active) {
    slot.cancel?.();
    slot.cancel = null;
    slot.elapsed = false;
  }
  slot.active = active;
  return active && slot.elapsed;
}

function advance(ms: number): void {
  clock.now += ms;
  const due = clock.pending.filter((timer) => timer.at <= clock.now);
  clock.pending = clock.pending.filter((timer) => timer.at > clock.now);
  for (const timer of due) timer.callback();
}

const noop = (): void => undefined;
const en = translator(DICTIONARIES, 'en');

function renderScan(overrides: Partial<ScanViewProps>): string {
  clock.cursor = 0;
  const props: ScanViewProps = {
    profile: demoProfile(),
    scan: initialScanState,
    batch: [],
    pendingRemove: null,
    replacingIndex: null,
    confirmingDone: false,
    viewWidthPx: 360,
    t: en,
    onFile: noop,
    onToggle: noop,
    onUndo: noop,
    onZoom: noop,
    onAccept: noop,
    onDiscard: noop,
    onRemoveRequest: noop,
    onRemoveConfirm: noop,
    onRemoveCancel: noop,
    onMove: noop,
    onScanAgain: noop,
    onCancelReplacing: noop,
    onDone: noop,
    onCommit: noop,
    onDoneCancel: noop,
    afterDelay,
    ...overrides,
  };
  return renderToStaticMarkup(<ScanView {...props} />);
}

function renderKeep(overrides: Partial<KeepViewProps>): string {
  clock.cursor = 0;
  const props: KeepViewProps = {
    profile: demoProfile(),
    pattern: generateSample(demoProfile(), 'diamond'),
    form: initialKeepForm,
    designs: [],
    pendingDeleteId: null,
    savedText: null,
    exportDone: false,
    failureKey: null,
    t: en,
    onFormAction: noop,
    onExport: noop,
    onSave: noop,
    onOpen: noop,
    onDeleteRequest: noop,
    onDeleteConfirm: noop,
    onDeleteCancel: noop,
    afterDelay,
    ...overrides,
  };
  return renderToStaticMarkup(<KeepView {...props} />);
}

beforeEach(() => {
  clock.now = 0;
  clock.next = 1;
  clock.pending = [];
  clock.slots = [];
  clock.cursor = 0;
});

describe('delayed Thread_Progress', () => {
  it('R7.5 reading a card shows the progress only after 300 ms, and not once the read ends', () => {
    const reading = { status: 'reading', fileName: 'card.png' } as const;
    expect(renderScan({ scan: reading })).not.toContain(en('progress.reading'));
    advance(299);
    expect(renderScan({ scan: reading })).not.toContain(en('progress.reading'));
    advance(1);
    expect(renderScan({ scan: reading })).toContain(en('progress.reading'));
    expect(renderScan({ scan: initialScanState })).not.toContain(en('progress.reading'));
  });

  it('R7.5 exporting a file shows the progress only after 300 ms, and not once the export ends', () => {
    expect(renderKeep({ exporting: true })).not.toContain(en('progress.exporting'));
    advance(299);
    expect(renderKeep({ exporting: true })).not.toContain(en('progress.exporting'));
    advance(1);
    const html = renderKeep({ exporting: true });
    expect(html).toContain(en('progress.exporting'));
    expect(html).not.toContain(en('progress.saving'));
    expect(renderKeep({ exporting: false })).not.toContain(en('progress.exporting'));
  });

  it('R7.5 saving a design shows the progress only after 300 ms, and not once the save ends', () => {
    expect(renderKeep({ saving: true })).not.toContain(en('progress.saving'));
    advance(299);
    expect(renderKeep({ saving: true })).not.toContain(en('progress.saving'));
    advance(1);
    const html = renderKeep({ saving: true });
    expect(html).toContain(en('progress.saving'));
    expect(html).not.toContain(en('progress.exporting'));
    expect(renderKeep({ saving: false })).not.toContain(en('progress.saving'));
  });

  it('R7.4 the progress adds no role="status" region to Keep', () => {
    const before = (renderKeep({}).match(/role="status"/g) ?? []).length;
    advance(300);
    const html = renderKeep({ exporting: true, saving: true });
    advance(300);
    const shown = renderKeep({ exporting: true, saving: true });
    expect(html).not.toContain(en('progress.saving'));
    expect(shown).toContain(en('progress.saving'));
    expect((shown.match(/role="status"/g) ?? []).length).toBe(before);
  });
});
