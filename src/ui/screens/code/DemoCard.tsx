import type { Translate } from '../../i18n/messages.ts';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { DEMO_BREAKPOINT_PICK } from '../../state/demoDesigns.ts';
import styles from './DemoCard.module.css';

export type DemoCardProps = {
  t: Translate;
  /** Without a Card_Profile there is no Diamond card to load and nothing to compare. */
  profileReady: boolean;
  /** The picks of the Current_Pattern; a breakpoint on DEMO_BREAKPOINT_PICK needs one more than that pick. */
  pickCount: number;
  /** True while the edited version is being saved for Compare. */
  busy: boolean;
  onLoad: () => void;
  onBreakpoint: () => void;
  onCompare: () => void;
};

/** The Demo card of the Code view: load the Diamond card, set a breakpoint, compare with an edited version. */
export function DemoCard({ t, profileReady, pickCount, busy, onLoad, onBreakpoint, onCompare }: DemoCardProps) {
  const needsDesign = pickCount <= DEMO_BREAKPOINT_PICK;
  return (
    <Card as="div" title={t('codeview.demo.title')} titleAs="h3" chips={[t('demo.chip')]} className={styles.card}>
      <p className={styles.text}>{t('codeview.demo.intro')}</p>
      <div className={styles.actions}>
        <Button disabled={!profileReady || busy} onClick={onLoad} data-demo="load">
          {t('codeview.demo.load')}
        </Button>
        <Button disabled={!profileReady || needsDesign} onClick={onBreakpoint} data-demo="breakpoint">
          {t('codeview.demo.breakpoint', { pick: DEMO_BREAKPOINT_PICK })}
        </Button>
        <Button disabled={!profileReady || busy} onClick={onCompare} data-demo="compare">
          {t('codeview.demo.compare')}
        </Button>
      </div>
      {needsDesign ? <p className={styles.text}>{t('codeview.demo.needDesign', { count: DEMO_BREAKPOINT_PICK + 1 })}</p> : null}
      <p className={styles.text}>{t('codeview.demo.compareHint')}</p>
    </Card>
  );
}
