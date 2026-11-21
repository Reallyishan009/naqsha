import { useState } from 'react';
import type { ComponentType, Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { AppAction } from '../../types.ts';
import type { RepairPanelProps } from './RepairPanel.tsx';
import { Button } from '../../components/Button.tsx';
import { Notice } from '../../components/Notice.tsx';
import styles from './Repair.module.css';
/** The panel and src/repair come in one separate chunk, requested the first time the weaver asks for suggestions. */
export type PanelModule = { RepairPanel: ComponentType<RepairPanelProps> };
const loadPanelModule = (): Promise<PanelModule> => import('./RepairPanel.tsx');
type PanelState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'open'; Panel: ComponentType<RepairPanelProps> }
  | { status: 'failed' };
export type RepairNoticeProps = {
  /** How many picks of the Current_Pattern are gaps. */
  gapCount: number;
  /** Pick indices (0-based) of the accepted repairs, ascending; the notice shows them from 1. */
  repairedPicks: ReadonlyArray<number>;
  canUndo: boolean;
  profile: CardProfile | null;
  pattern: Pattern;
  t: Translate;
  dispatch: Dispatch<AppAction>;
  /** Injected so tests can avoid the real dynamic import. */
  loadPanel?: () => Promise<PanelModule>;
};
/**
 * The notice that cards could not be read, the button that asks for suggestions, and the accepted repairs with Undo.
 * It holds no suggestion and imports no repair code: that arrives with the panel, after the button is pressed.
 */
export function RepairNotice({ gapCount, repairedPicks, canUndo, profile, pattern, t, dispatch, loadPanel = loadPanelModule }: RepairNoticeProps) {
  const [panel, setPanel] = useState<PanelState>({ status: 'closed' });
  if (gapCount === 0 && repairedPicks.length === 0) return null;
  const onToggle = (): void => {
    if (panel.status === 'open' || panel.status === 'failed') {
      setPanel({ status: 'closed' });
      return;
    }
    setPanel({ status: 'loading' });
    loadPanel().then(
      (module) => setPanel({ status: 'open', Panel: module.RepairPanel }),
      () => setPanel({ status: 'failed' }),
    );
  };
  const expanded = panel.status === 'open';
  const Panel = panel.status === 'open' ? panel.Panel : null;
  return (
    <div className={styles.notice}>
      <Notice variant={gapCount === 0 ? 'information' : 'warning'} word={t(gapCount === 0 ? 'notice.information' : 'notice.warning')}>
        {gapCount === 0 ? null : (
          <>
            <p className={styles.noticeText}>{t(gapCount === 1 ? 'weave.repair.notice.one' : 'weave.repair.notice.other', { count: gapCount })}</p>
            <div className={styles.actions}>
              <Button aria-expanded={expanded} disabled={profile === null || panel.status === 'loading'} onClick={onToggle}>
                {t(expanded ? 'weave.repair.hide' : 'weave.repair.suggest')}
              </Button>
            </div>
            {panel.status === 'loading' ? <p>{t('weave.repair.loading')}</p> : null}
          </>
        )}
        {repairedPicks.length === 0 ? null : (
          <>
            <p className={styles.noticeText}>{t('weave.repair.repaired', { picks: repairedPicks.map((pick) => pick + 1).join(', ') })}</p>
            <div className={styles.actions}>
              <Button
                disabled={!canUndo}
                onClick={() => {
                  dispatch({ type: 'undo-repair' });
                  dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'repair.undone' });
                }}
              >
                {t('weave.repair.undo')}
              </Button>
            </div>
          </>
        )}
      </Notice>
      {panel.status === 'failed' ? (
        <Notice variant="error" word={t('notice.error')}>
          {t('weave.repair.loadFailed')}
        </Notice>
      ) : null}
      {Panel !== null && profile !== null && gapCount > 0 ? <Panel profile={profile} pattern={pattern} t={t} dispatch={dispatch} /> : null}
    </div>
  );
}
