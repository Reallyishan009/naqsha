import { useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { printFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { generateSample, sampleWithLostCards } from '../../samples/sampleDesigns.ts';
import type { AppAction, Confirm, SampleDesign } from '../../types.ts';
import { Button } from '../../components/Button.tsx';
import { Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Panel } from '../../components/Panel.tsx';
import styles from './WeaveScreen.module.css';

export const SAMPLE_DESIGNS: ReadonlyArray<SampleDesign> = ['diamond', 'border', 'floral'];

/** The part of `printable/download.ts` that Try it uses. Loaded on demand so it stays out of the Initial_Load. */
export type PrintModule = Pick<typeof import('../../printable/download.ts'), 'printPng' | 'printSvg'>;

const loadPrintModule = (): Promise<PrintModule> => import('../../printable/download.ts');

export type PrintKind = 'png' | 'svg';

/** The pick number (1 to pickCount) for any typed value: rounded, never outside the range, 1 for NaN or no picks. */
export function clampPickNumber(value: number, pickCount: number): number {
  const last = Number.isInteger(pickCount) && pickCount > 0 ? pickCount : 1;
  if (Number.isNaN(value)) return 1;
  return Math.min(last, Math.max(1, Math.round(value)));
}

/** The message key to show when a print did not start a download, or null when it did. Never throws. */
export async function runPrint(
  kind: PrintKind,
  profile: CardProfile,
  pattern: Pattern,
  pickNumber: number,
  fileName: string,
  load: () => Promise<PrintModule> = loadPrintModule,
): Promise<string | null> {
  try {
    const grid = pattern[clampPickNumber(pickNumber, pattern.length) - 1];
    const module = await load();
    const result =
      kind === 'png'
        ? await module.printPng(profile, grid, fileName)
        : module.printSvg(profile, grid, fileName);
    return result.ok ? null : printFailureKey(result.failure);
  } catch {
    return 'error.generic';
  }
}

export type TryItProps = {
  /** The loaded Card_Profile, or null while it is loading or failed. */
  profile: CardProfile | null;
  confirm: Confirm | null;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests can avoid the real download module. */
  loadPrint?: () => Promise<PrintModule>;
};

type PrintControlsProps = {
  design: SampleDesign;
  profile: CardProfile;
  pattern: Pattern;
  t: Translate;
  loadPrint: () => Promise<PrintModule>;
};

/** Pick chooser, PNG and SVG buttons and the two print sentences for one Sample_Design (R21.1, R21.2, R21.6, R21.9). */
function PrintControls({ design, profile, pattern, t, loadPrint }: PrintControlsProps) {
  const [pickNumber, setPickNumber] = useState(1);
  const [failureKey, setFailureKey] = useState<string | null>(null);
  const pickCount = pattern.length;
  const shownPick = clampPickNumber(pickNumber, pickCount);
  const start = (kind: PrintKind): void => {
    setFailureKey(null);
    void runPrint(kind, profile, pattern, shownPick, `naqsha-${design}-pick-${shownPick}.${kind}`, loadPrint).then(
      setFailureKey,
    );
  };
  return (
    <div role="group" aria-label={`${t(`tryit.${design}`)}: ${t('print.pick')}`} className={styles.printGroup}>
      <Field
        className={styles.field}
        label={`${t(`tryit.${design}`)}: ${t('print.pick')} (${shownPick} / ${pickCount})`}
      >
        <input
          type="number"
          min={1}
          max={Math.max(1, pickCount)}
          step={1}
          value={shownPick}
          onChange={(event) => setPickNumber(clampPickNumber(event.currentTarget.valueAsNumber, pickCount))}
        />
      </Field>
      <div className={styles.strip}>
        <Button onClick={() => start('png')}>{t('print.png')}</Button>
        <Button onClick={() => start('svg')}>{t('print.svg')}</Button>
      </div>
      <p>{t('print.scale')}</p>
      <p>{t('print.notCut')}</p>
      {failureKey === null ? null : (
        <Notice variant="error" word={t('notice.error')}>
          {t(failureKey)}
        </Notice>
      )}
    </div>
  );
}

/** Three Sample_Designs. Choosing one replaces the Current_Pattern, after a question when scanned cards are unsaved (R4.7). */
export function TryIt({ profile, confirm, dispatch, t, loadPrint = loadPrintModule }: TryItProps) {
  const samples = useMemo(
    () => (profile === null ? null : SAMPLE_DESIGNS.map((design) => ({ design, pattern: generateSample(profile, design) }))),
    [profile],
  );
  const asking = confirm !== null && confirm.kind === 'replace-with-sample';
  return (
    <section aria-labelledby="tryit-title" className={styles.tryIt}>
      <h3 id="tryit-title" className={styles.sectionTitle}>
        {t('tryit.title')}
      </h3>
      <p>{t('tryit.intro')}</p>
      <div className={styles.strip}>
        {SAMPLE_DESIGNS.map((design) => (
          <Button
            key={design}
            data-sample={design}
            disabled={profile === null}
            onClick={() => {
              if (profile === null) return;
              dispatch({ type: 'request-sample', design, pattern: generateSample(profile, design) });
            }}
          >
            {t(`tryit.${design}`)}
          </Button>
        ))}
      </div>
      <div className={styles.strip}>
        <Button
          disabled={profile === null}
          onClick={() => {
            if (profile === null) return;
            dispatch({ type: 'request-sample', design: 'diamond', pattern: sampleWithLostCards(profile) });
          }}
        >
          {t('tryit.lost')}
        </Button>
      </div>
      <p>{t('tryit.lost.hint')}</p>
      {profile === null || samples === null
        ? null
        : samples.map(({ design, pattern }) => (
            <PrintControls key={design} design={design} profile={profile} pattern={pattern} t={t} loadPrint={loadPrint} />
          ))}
      {asking ? (
        <Panel role="group" aria-label={t('tryit.confirmReplace')} className={styles.confirm}>
          <p>{t('tryit.confirmReplace')}</p>
          <div className={styles.strip}>
            <Button onClick={() => dispatch({ type: 'confirm-accepted' })}>{t('tryit.confirmYes')}</Button>
            <Button onClick={() => dispatch({ type: 'confirm-dismissed' })}>{t('tryit.confirmNo')}</Button>
          </div>
        </Panel>
      ) : null}
    </section>
  );
}
