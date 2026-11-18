import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent } from 'react';
import { deleteDesign, getDesign, listDesigns, saveDesign } from '../../../archive/index.ts';
import type { ArchiveDeps, ArchiveFailure, DesignSummary, Metadata } from '../../../archive/index.ts';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import type { DownloadDeps, ExportOptions } from '../../../exporter/index.ts';
import { archiveFailureKey, exportFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import {
  afterSaveFailure,
  canExport,
  canSave,
  initialKeepForm,
  keepFormReducer,
  runExport,
  savedLabel,
  summaryRow,
} from '../../state/keep.ts';
import type { KeepForm, KeepFormAction } from '../../state/keep.ts';
import { ProfileNotice } from '../../ProfileNotice.tsx';
import type { AppAction, AppState } from '../../types.ts';
import styles from './KeepScreen.module.css';

const FIELDS: ReadonlyArray<keyof Metadata> = ['name', 'naqshband', 'weaver', 'place', 'date', 'notes'];

type OptionGroup = {
  [K in keyof ExportOptions]: { name: K; values: ReadonlyArray<ExportOptions[K]> };
}[keyof ExportOptions];

/** The four export choices, in the order the user sees them (R5.2). */
const OPTION_GROUPS: ReadonlyArray<OptionGroup> = [
  { name: 'bitDepth', values: [1, 8] },
  { name: 'liftColour', values: ['black', 'white'] },
  { name: 'pickOrder', values: ['first-at-top', 'first-at-bottom'] },
  { name: 'endOrder', values: ['first-at-left', 'first-at-right'] },
];

export type SaveOutcome = { ok: true; id: string; label: string } | { ok: false; failure: ArchiveFailure };

/** Saves the Current_Pattern with the entered Metadata. Never throws; a failure is a value (R7.3, R7.4). */
export async function runSave(
  profile: CardProfile,
  pattern: Pattern,
  form: KeepForm,
  untitled: string,
  deps?: ArchiveDeps,
): Promise<SaveOutcome> {
  const result = await saveDesign({ pattern, profileName: profile.name, metadata: form.metadata }, deps);
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, id: result.value, label: savedLabel(form.metadata, untitled) };
}

export type OpenOutcome = { ok: true; id: string; pattern: Pattern } | { ok: false; failure: ArchiveFailure };

export async function runOpen(id: string, deps?: ArchiveDeps): Promise<OpenOutcome> {
  const result = await getDesign(id, deps);
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, id, pattern: result.value.pattern };
}

/** Deletes one design, then reads the list again so the screen shows what is stored. */
export async function runDelete(
  id: string,
  deps?: ArchiveDeps,
): Promise<{ failure: ArchiveFailure | null; designs: DesignSummary[] | null }> {
  const removed = await deleteDesign(id, deps);
  const listed = await listDesigns(deps);
  return {
    failure: removed.ok ? null : removed.failure,
    designs: listed.ok ? listed.value : null,
  };
}

export type KeepViewProps = {
  profile: CardProfile | null;
  pattern: Pattern;
  form: KeepForm;
  /** null while the list has not loaded or could not be read. */
  designs: ReadonlyArray<DesignSummary> | null;
  pendingDeleteId: string | null;
  /** The confirmation text after a save, or null. */
  savedText: string | null;
  exportDone: boolean;
  /** Message key of the last failure shown on this screen, or null. */
  failureKey: string | null;
  t: Translate;
  onFormAction: (action: KeepFormAction) => void;
  onExport: () => void;
  onSave: () => void;
  onOpen: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
};

type ConfirmProps = { t: Translate; onYes: () => void; onNo: () => void };

/** Asks before deleting. Focus starts on the safe choice; Escape cancels (R7.8). */
function DeleteConfirm({ t, onYes, onNo }: ConfirmProps) {
  const safeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    safeRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') onNo();
  };
  return (
    <div role="group" aria-label={t('keep.list.deleteConfirm')} className={styles.confirm} onKeyDown={onKeyDown}>
      <p>{t('keep.list.deleteConfirm')}</p>
      <div className={styles.row}>
        <button ref={safeRef} type="button" className={styles.button} onClick={onNo}>
          {t('keep.list.deleteNo')}
        </button>
        <button type="button" className={styles.button} onClick={onYes}>
          {t('keep.list.deleteYes')}
        </button>
      </div>
    </div>
  );
}

/** What Keep draws. No state of its own, so tests can render every case (R5, R7, R22). */
export function KeepView(props: KeepViewProps) {
  const { profile, pattern, form, designs, pendingDeleteId, savedText, exportDone, failureKey, t } = props;
  const exportEnabled = profile !== null && canExport(pattern);
  const saveEnabled = profile !== null && canSave(pattern);
  const untitled = t('keep.untitled');
  const profileName = profile === null ? '' : profile.name;
  const notice = profile === null ? null : <ProfileNotice profile={profile} t={t} />;

  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.keep')}
      </h2>

      {pattern.length === 0 ? <p className={styles.empty}>{t('keep.empty')}</p> : null}
      {failureKey === null ? null : (
        <p role="alert" className={styles.failure}>
          {t(failureKey)}
        </p>
      )}

      <section aria-labelledby="keep-export-title" className={styles.panel}>
        <h3 id="keep-export-title" className={styles.sectionTitle}>
          {t('keep.export.heading')}
        </h3>
        {OPTION_GROUPS.map((group) => (
          <fieldset key={group.name} className={styles.fieldset}>
            <legend className={styles.legend}>{t(`keep.export.${group.name}`)}</legend>
            {group.values.map((value) => (
              <label key={String(value)} className={styles.choice}>
                <input
                  type="radio"
                  name={`keep-option-${group.name}`}
                  className={styles.radio}
                  value={String(value)}
                  checked={form.options[group.name] === value}
                  onChange={() => props.onFormAction({ type: 'set-option', options: { ...form.options, [group.name]: value } })}
                />
                <span>{t(`keep.export.${group.name}.${value}`)}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <p>{t('keep.export.untested')}</p>
        {notice}
        <button type="button" className={styles.button} disabled={!exportEnabled} onClick={props.onExport}>
          {t('keep.export.button')}
        </button>
        {exportDone ? <p className={styles.done}>{t('keep.export.done')}</p> : null}
      </section>

      <section aria-labelledby="keep-save-title" className={styles.panel}>
        <h3 id="keep-save-title" className={styles.sectionTitle}>
          {t('keep.save.heading')}
        </h3>
        <div className={styles.fields}>
          {FIELDS.map((field) => (
            <label key={field} className={styles.field}>
              <span>{t(`keep.field.${field}`)}</span>
              {field === 'notes' ? (
                <textarea
                  className={styles.input}
                  rows={3}
                  value={form.metadata[field]}
                  onChange={(event) => props.onFormAction({ type: 'set-field', field, value: event.currentTarget.value })}
                />
              ) : (
                <input
                  type="text"
                  className={styles.input}
                  value={form.metadata[field]}
                  onChange={(event) => props.onFormAction({ type: 'set-field', field, value: event.currentTarget.value })}
                />
              )}
            </label>
          ))}
        </div>
        {notice}
        <button type="button" className={styles.button} disabled={!saveEnabled} onClick={props.onSave}>
          {t('keep.save.button')}
        </button>
        <p className={styles.legal}>{t('keep.save.legal')}</p>
        {savedText === null ? null : (
          <p id="keep-saved" tabIndex={-1} className={styles.done}>
            {savedText}
          </p>
        )}
      </section>

      <section aria-labelledby="keep-list-title" className={styles.panel}>
        <h3 id="keep-list-title" tabIndex={-1} className={styles.sectionTitle}>
          {t('keep.list.heading')}
        </h3>
        {designs !== null && designs.length === 0 ? <p>{t('keep.list.empty')}</p> : null}
        {designs === null || designs.length === 0 ? null : (
          <ul className={styles.list}>
            {designs.map((summary) => {
              const row = summaryRow(summary, profileName, untitled);
              const confirming = pendingDeleteId === summary.id;
              return (
                <li key={summary.id} className={styles.item}>
                  <p className={styles.itemName}>{row.name}</p>
                  <p className={styles.itemDetail}>
                    {[row.place, row.date, t('keep.list.picks', { count: row.pickCount })]
                      .filter((part) => part !== '')
                      .join(' · ')}
                  </p>
                  {row.profileName === null ? null : (
                    <p className={styles.itemDetail}>{t('keep.list.profile', { name: row.profileName })}</p>
                  )}
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.button}
                      aria-label={`${t('keep.list.open')}: ${row.name}`}
                      onClick={() => props.onOpen(summary.id)}
                    >
                      {t('keep.list.open')}
                    </button>
                    <button
                      type="button"
                      id={`keep-delete-${summary.id}`}
                      className={styles.button}
                      aria-label={`${t('keep.list.delete')}: ${row.name}`}
                      onClick={() => props.onDeleteRequest(summary.id)}
                    >
                      {t('keep.list.delete')}
                    </button>
                  </div>
                  {confirming ? <DeleteConfirm t={t} onYes={props.onDeleteConfirm} onNo={props.onDeleteCancel} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

export type KeepScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests use a fake store; the browser uses IndexedDB. */
  archiveDeps?: ArchiveDeps;
  downloadDeps?: DownloadDeps;
};

export function KeepScreen({ state, dispatch, t, archiveDeps, downloadDeps }: KeepScreenProps) {
  const profile = state.profile.status === 'ready' ? state.profile.profile : null;
  const pattern = state.current.pattern;
  const [form, dispatchForm] = useReducer(keepFormReducer, initialKeepForm);
  const [designs, setDesigns] = useState<ReadonlyArray<DesignSummary> | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [savedText, setSavedText] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [failureKey, setFailureKey] = useState<string | null>(null);
  const returnFocusRef = useRef<string | null>(null);
  const focusSavedRef = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    const listed = await listDesigns(archiveDeps);
    if (listed.ok) {
      setDesigns(listed.value);
    } else {
      setDesigns(null);
      setFailureKey(archiveFailureKey(listed.failure));
    }
  }, [archiveDeps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Focus follows the action: the saved text after a save, the row's Delete button or the list heading after a confirmation closes.
  useEffect(() => {
    if (focusSavedRef.current && savedText !== null) {
      focusSavedRef.current = false;
      document.getElementById('keep-saved')?.focus();
    }
  }, [savedText]);
  useEffect(() => {
    if (pendingDeleteId !== null || returnFocusRef.current === null) return;
    const id = returnFocusRef.current;
    returnFocusRef.current = null;
    const target = document.getElementById(`keep-delete-${id}`) ?? document.getElementById('keep-list-title');
    target?.focus();
  }, [pendingDeleteId, designs]);

  const onExport = (): void => {
    setExportDone(false);
    if (profile === null) return;
    const outcome = runExport(profile, pattern, form.options, downloadDeps);
    if (outcome.ok) {
      setFailureKey(null);
      setExportDone(true);
      dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'keep.export.done' });
    } else {
      const key = exportFailureKey(outcome.failure);
      setFailureKey(key);
      dispatch({ type: 'announce', kind: 'error', messageKey: key });
    }
  };

  const onSave = (): void => {
    if (profile === null) return;
    setSavedText(null);
    void runSave(profile, pattern, form, t('keep.untitled'), archiveDeps).then(async (outcome) => {
      if (outcome.ok) {
        setFailureKey(null);
        focusSavedRef.current = true;
        setSavedText(t('keep.saved', { name: outcome.label }));
        dispatch({ type: 'mark-saved', id: outcome.id });
        await refresh();
      } else {
        // The form is not touched: what the user typed stays (R7.4).
        const { announce } = afterSaveFailure(form, outcome.failure);
        setFailureKey(announce.messageKey);
        dispatch(announce);
      }
    });
  };

  const onOpen = (id: string): void => {
    void runOpen(id, archiveDeps).then((outcome) => {
      if (outcome.ok) {
        dispatch({ type: 'open-saved', id: outcome.id, pattern: outcome.pattern });
      } else {
        const key = archiveFailureKey(outcome.failure);
        setFailureKey(key);
        dispatch({ type: 'announce', kind: 'error', messageKey: key });
      }
    });
  };

  const onDeleteConfirm = (): void => {
    const id = pendingDeleteId;
    if (id === null) return;
    returnFocusRef.current = id;
    setPendingDeleteId(null);
    void runDelete(id, archiveDeps).then(({ failure, designs: next }) => {
      if (next !== null) setDesigns(next);
      if (failure === null) {
        setFailureKey(null);
        dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'keep.list.deleted' });
      } else {
        const key = archiveFailureKey(failure);
        setFailureKey(key);
        dispatch({ type: 'announce', kind: 'error', messageKey: key });
      }
    });
  };

  return (
    <KeepView
      profile={profile}
      pattern={pattern}
      form={form}
      designs={designs}
      pendingDeleteId={pendingDeleteId}
      savedText={savedText}
      exportDone={exportDone}
      failureKey={failureKey}
      t={t}
      onFormAction={dispatchForm}
      onExport={onExport}
      onSave={onSave}
      onOpen={onOpen}
      onDeleteRequest={setPendingDeleteId}
      onDeleteConfirm={onDeleteConfirm}
      onDeleteCancel={() => {
        returnFocusRef.current = pendingDeleteId;
        setPendingDeleteId(null);
      }}
    />
  );
}
