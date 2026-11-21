import type { DesignGroup, DesignSummary } from '../../../archive/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { compareTargets, designHeading, versionDetails } from '../../state/keep.ts';
import type { CompareChoice, Language, PatternOrigin } from '../../types.ts';
import { Button } from '../../components/Button.tsx';
import { DeleteConfirm } from './DeleteConfirm.tsx';
import styles from './KeepScreen.module.css';
export type EntryHandlers = {
  onToggle: (designId: string) => void;
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
  onCompare: (first: CompareChoice, second: CompareChoice) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};
export type DesignEntryProps = EntryHandlers & {
  group: DesignGroup;
  profileName: string;
  origin: PatternOrigin;
  language: Language;
  expanded: boolean;
  pendingDeleteId: string | null;
  t: Translate;
};
type VersionActionsProps = EntryHandlers & {
  group: DesignGroup;
  version: DesignSummary;
  /** What the action names say after the colon, so each button of a list says which version it acts on. */
  subject: string;
  origin: PatternOrigin;
  pendingDeleteId: string | null;
  t: Translate;
};
/** Open, Compare, Restore and Delete for one version. Every button names its version. */
function VersionActions({ group, version, subject, origin, pendingDeleteId, t, ...handlers }: VersionActionsProps) {
  const targets = compareTargets(group, version.id, origin);
  const named = (key: string): string => `${t(key)}: ${subject}`;
  return (
    <>
      <div className={styles.actions}>
        <Button aria-label={named('keep.list.open')} onClick={() => handlers.onOpen(version.id)}>
          {t('keep.list.open')}
        </Button>
        {targets.previous === null ? null : (
          <Button
            aria-label={named('keep.version.comparePrevious')}
            onClick={() =>
              handlers.onCompare({ kind: 'saved', id: targets.previous!.id }, { kind: 'saved', id: version.id })
            }
          >
            {t('keep.version.comparePrevious')}
          </Button>
        )}
        {targets.openDesignId === null ? null : (
          <Button
            aria-label={named('keep.version.compareOpen')}
            onClick={() => handlers.onCompare({ kind: 'saved', id: version.id }, { kind: 'current' })}
          >
            {t('keep.version.compareOpen')}
          </Button>
        )}
        <Button aria-label={named('keep.version.restore')} onClick={() => handlers.onRestore(version.id)}>
          {t('keep.version.restore')}
        </Button>
        <Button
          id={`keep-delete-${version.id}`}
          aria-label={named('keep.list.delete')}
          onClick={() => handlers.onDeleteRequest(version.id)}
        >
          {t('keep.list.delete')}
        </Button>
      </div>
      {pendingDeleteId === version.id ? (
        <DeleteConfirm t={t} onYes={handlers.onDeleteConfirm} onNo={handlers.onDeleteCancel} />
      ) : null}
    </>
  );
}
/** One design: the newest version's details and the version count. More than one version opens into a list. */
export function DesignEntry(props: DesignEntryProps) {
  const { group, profileName, origin, language, expanded, pendingDeleteId, t, ...handlers } = props;
  const untitled = t('keep.untitled');
  const heading = designHeading(group.newest, profileName, untitled);
  const countText = t(group.versionCount === 1 ? 'keep.list.versionCount.one' : 'keep.list.versionCount.other', {
    count: group.versionCount,
  });
  const versionsId = `keep-versions-${group.designId}`;
  const shared = { group, origin, pendingDeleteId, t, ...handlers };
  return (
    <li className={styles.item}>
      <p className={styles.itemName}>{heading.name}</p>
      <p className={styles.itemDetail}>
        {[heading.place, heading.date, t('keep.list.picks', { count: heading.pickCount }), countText]
          .filter((part) => part !== '')
          .join(' · ')}
      </p>
      {heading.profileName === null ? null : <p className={styles.itemDetail}>{t('keep.list.profile', { name: heading.profileName })}</p>}
      {group.versionCount === 1 ? (
        <>
          {group.newest.note === undefined ? null : (
            <p className={styles.itemDetail}>{t('keep.version.note', { note: group.newest.note })}</p>
          )}
          <VersionActions {...shared} version={group.newest} subject={heading.name} />
        </>
      ) : (
        <>
          <div className={styles.actions}>
            <Button
              aria-expanded={expanded}
              aria-controls={versionsId}
              aria-label={`${t(expanded ? 'keep.list.hideVersions' : 'keep.list.showVersions')}: ${heading.name}`}
              onClick={() => handlers.onToggle(group.designId)}
            >
              {t(expanded ? 'keep.list.hideVersions' : 'keep.list.showVersions')}
            </Button>
          </div>
          {expanded ? (
            <div id={versionsId} role="group" aria-label={t('keep.version.heading', { name: heading.name })} className={styles.versions}>
              <h4 className={styles.versionsTitle}>{t('keep.version.heading', { name: heading.name })}</h4>
              <ol className={styles.list}>
                {group.versions.map((version, index) => {
                  const detail = versionDetails(version, language, untitled);
                  return (
                    <li key={version.id} className={styles.version}>
                      <p className={styles.itemName}>
                        {detail.savedAt === '' ? detail.name : t('keep.version.saved', { date: detail.savedAt })}
                        {index === 0 ? <span className={styles.badge}>{t('keep.version.newest')}</span> : null}
                      </p>
                      <p className={styles.itemDetail}>
                        {detail.note === '' ? t('keep.version.noNote') : t('keep.version.note', { note: detail.note })}
                      </p>
                      <p className={styles.itemDetail}>{t('keep.list.picks', { count: detail.pickCount })}</p>
                      <VersionActions
                        {...shared}
                        version={version}
                        subject={detail.savedAt === '' ? detail.name : `${detail.name}, ${detail.savedAt}`}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}
