import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { suggestRepairs } from '../../../repair/index.ts';
import type { GapRepair, RepairResult, Suggestion } from '../../../repair/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { AppAction } from '../../types.ts';
import { evidenceText, failureKey, highConfidenceItems, punchedCount } from './repairText.ts';
import { CardDrawing } from '../../illustrations/CardDrawing.tsx';
import { Button } from '../../components/Button.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Panel } from '../../components/Panel.tsx';
import styles from './Repair.module.css';
export type RepairPanelViewProps = {
  result: RepairResult;
  /** The Card_Profile the proposed cards are drawn from; null draws the notice that the card cannot be drawn. */
  profile: CardProfile | null;
  /** Keys `${pick}:${kind}` of the suggestions the weaver skipped. */
  skipped: ReadonlySet<string>;
  t: Translate;
  headingRef?: React.Ref<HTMLHeadingElement>;
  onAccept: (pick: number, suggestion: Suggestion) => void;
  onAcceptAllHigh: () => void;
  onSkip: (key: string) => void;
  onShowAgain: (key: string) => void;
};
export const skipKey = (pick: number, kind: Suggestion['kind']): string => `${pick}:${kind}`;
function GapItem({ gap, profile, skipped, t, onAccept, onSkip, onShowAgain }: { gap: GapRepair } & Pick<RepairPanelViewProps, 'profile' | 'skipped' | 't' | 'onAccept' | 'onSkip' | 'onShowAgain'>) {
  const where = t('repair.gap.short', { pick: gap.pick + 1 });
  return (
    <li className={styles.gap}>
      <p className={styles.gapTitle}>{t('repair.gap', { pick: gap.pick + 1, state: t(`repair.gap.${gap.gapKind}`) })}</p>
      <CardDrawing
        profile={profile}
        grid={null}
        state={gap.gapKind}
        pickNumber={gap.pick + 1}
        adjacentText
        className={styles.lostCard}
        t={t}
      />
      {gap.suggestions.length === 0 ? <p>{t(`repair.none.${gap.none ?? 'no-evidence'}`)}</p> : null}
      {gap.conflict ? (
        <Notice variant="warning" word={t('notice.warning')}>
          {t('repair.conflict')}
        </Notice>
      ) : null}
      {gap.suggestions.map((suggestion) => {
        const key = skipKey(gap.pick, suggestion.kind);
        const kind = t(`repair.kind.${suggestion.kind}`);
        if (skipped.has(key)) {
          return (
            <div key={key} className={styles.suggestion}>
              <p className={styles.kind}>{kind}</p>
              <p>{t('repair.skipped')}</p>
              <Button aria-label={`${t('repair.showAgain')}: ${where}, ${kind}`} onClick={() => onShowAgain(key)}>
                {t('repair.showAgain')}
              </Button>
            </div>
          );
        }
        return (
          <div key={key} className={styles.suggestion}>
            <p className={styles.kind}>
              {kind} · {t(`repair.confidence.${suggestion.confidence}`)}
            </p>
            <p className={styles.evidence}>{evidenceText(t, suggestion)}</p>
            <CardDrawing
              profile={profile}
              grid={suggestion.card}
              marks="rings"
              label={t('repair.draw', { ...punchedCount(suggestion.card) })}
              className={styles.drawing}
              t={t}
            />
            <div className={styles.actions}>
              <Button aria-label={`${t('repair.accept')}: ${where}, ${kind}`} onClick={() => onAccept(gap.pick, suggestion)}>
                {t('repair.accept')}
              </Button>
              <Button aria-label={`${t('repair.skip')}: ${where}, ${kind}`} onClick={() => onSkip(key)}>
                {t('repair.skip')}
              </Button>
            </div>
          </div>
        );
      })}
      {gap.notApplied.length === 0 ? null : (
        <details className={styles.why}>
          <summary>{t('repair.why')}</summary>
          <ul className={styles.whyList}>
            {gap.notApplied.map((entry) => (
              <li key={entry.kind}>
                {t(`repair.kind.${entry.kind}`)}: {t(`repair.notApplied.${entry.reason}`)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
/** What the panel draws. No state of its own, so tests can render every case. */
export function RepairPanelView(props: RepairPanelViewProps) {
  const { result, t } = props;
  const headingId = useId();
  const highCount = result.ok ? highConfidenceItems(result.gaps).length : 0;
  return (
    <Panel as="section" aria-labelledby={headingId} className={styles.panel}>
      <h3 id={headingId} tabIndex={-1} ref={props.headingRef} className={styles.heading}>
        {t('repair.heading')}
      </h3>
      <p className={styles.guesses}>{t('repair.guesses')}</p>
      {!result.ok ? (
        <Notice variant="error" word={t('notice.error')}>
          {t(failureKey(result.failure))}
        </Notice>
      ) : result.gaps.length === 0 ? (
        <p>{t('repair.noGaps')}</p>
      ) : (
        <>
          <p className={styles.legend}>{t('repair.legend')}</p>
          <ul className={styles.gapList}>
            {result.gaps.map((gap) => (
              <GapItem key={gap.pick} gap={gap} profile={props.profile} skipped={props.skipped} t={t} onAccept={props.onAccept} onSkip={props.onSkip} onShowAgain={props.onShowAgain} />
            ))}
          </ul>
          <div className={styles.actions}>
            <Button disabled={highCount === 0} onClick={props.onAcceptAllHigh}>
              {t('repair.acceptAll')}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
export type RepairPanelProps = {
  profile: CardProfile;
  pattern: Pattern;
  t: Translate;
  dispatch: Dispatch<AppAction>;
};
/** The suggestions for the Current_Pattern. Nothing changes until a button is pressed. */
export function RepairPanel({ profile, pattern, t, dispatch }: RepairPanelProps) {
  const result = useMemo(() => suggestRepairs(pattern, profile), [pattern, profile]);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const focusHeading = useRef(false);
  // An accepted gap leaves the list, taking its button with it, so focus goes to the heading.
  useEffect(() => {
    if (focusHeading.current) {
      focusHeading.current = false;
      headingRef.current?.focus();
    }
  }, [pattern]);
  return (
    <RepairPanelView
      result={result}
      profile={profile}
      skipped={skipped}
      t={t}
      headingRef={headingRef}
      onAccept={(pick, suggestion) => {
        focusHeading.current = true;
        dispatch({ type: 'accept-repairs', items: [{ pick, card: suggestion.card }] });
        dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'repair.accepted', params: { picks: String(pick + 1) } });
      }}
      onAcceptAllHigh={() => {
        if (!result.ok) return;
        const items = highConfidenceItems(result.gaps);
        if (items.length === 0) return;
        focusHeading.current = true;
        dispatch({ type: 'accept-repairs', items });
        dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'repair.accepted', params: { picks: items.map((item) => item.pick + 1).join(', ') } });
      }}
      onSkip={(key) => setSkipped((current) => new Set(current).add(key))}
      onShowAgain={(key) =>
        setSkipped((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        })
      }
    />
  );
}
