import type { Dispatch } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { generateSample } from '../../samples/sampleDesigns.ts';
import type { AppAction, Confirm, SampleDesign } from '../../types.ts';
import styles from './WeaveScreen.module.css';

export const SAMPLE_DESIGNS: ReadonlyArray<SampleDesign> = ['diamond', 'border', 'floral'];

export type TryItProps = {
  /** The loaded Card_Profile, or null while it is loading or failed. */
  profile: CardProfile | null;
  confirm: Confirm | null;
  dispatch: Dispatch<AppAction>;
  t: Translate;
};

/** Three Sample_Designs. Choosing one replaces the Current_Pattern, after a question when scanned cards are unsaved (R4.7). */
export function TryIt({ profile, confirm, dispatch, t }: TryItProps) {
  const asking = confirm !== null && confirm.kind === 'replace-with-sample';
  return (
    <section aria-labelledby="tryit-title" className={styles.tryIt}>
      <h3 id="tryit-title" className={styles.sectionTitle}>
        {t('tryit.title')}
      </h3>
      <p>{t('tryit.intro')}</p>
      <div className={styles.row}>
        {SAMPLE_DESIGNS.map((design) => (
          <button
            key={design}
            type="button"
            className={styles.button}
            disabled={profile === null}
            onClick={() => {
              if (profile === null) return;
              dispatch({ type: 'request-sample', design, pattern: generateSample(profile, design) });
            }}
          >
            {t(`tryit.${design}`)}
          </button>
        ))}
      </div>
      {asking ? (
        <div role="group" aria-label={t('tryit.confirmReplace')} className={styles.confirm}>
          <p>{t('tryit.confirmReplace')}</p>
          <div className={styles.row}>
            <button type="button" className={styles.button} onClick={() => dispatch({ type: 'confirm-accepted' })}>
              {t('tryit.confirmYes')}
            </button>
            <button type="button" className={styles.button} onClick={() => dispatch({ type: 'confirm-dismissed' })}>
              {t('tryit.confirmNo')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
