import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { NOTE_MAX, deleteDesign, getDesign, groupDesigns, listDesigns, saveDesign } from '../../../archive/index.ts';
import type { ArchiveDeps, ArchiveFailure, DesignSummary, Metadata } from '../../../archive/index.ts';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import type { DownloadDeps, ExportOptions } from '../../../exporter/index.ts';
import { archiveFailureKey, exportFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import {
  afterSaveFailure,
  canExport,
  canSave,
  continuesId,
  initialKeepForm,
  keepFormReducer,
  runExport,
  withGuessesLine,
  savedLabel,
} from '../../state/keep.ts';
import type { KeepForm, KeepFormAction } from '../../state/keep.ts';
import { ProfileNotice } from '../../ProfileNotice.tsx';
import { Button } from '../../components/Button.tsx';
import { Field } from '../../components/Field.tsx';
import { useAfterDelay } from '../../components/delay.ts';
import { Disclosure } from '../../components/Disclosure.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Panel } from '../../components/Panel.tsx';
import { ScreenIntro } from '../../components/ScreenIntro.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { WeftProgress } from '../../components/WeftProgress.tsx';
import type { AppAction, AppState, CompareChoice, Language, PatternOrigin } from '../../types.ts';
import { DesignEntry } from './DesignEntry.tsx';
import styles from './KeepScreen.module.css';

/** The Metadata fields inside "More"; the name is the one field outside it. */
const MORE_FIELDS: ReadonlyArray<keyof Metadata> = ['naqshband', 'weaver', 'place', 'date', 'notes'];

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
  /** The id of the version this save continues; without it the save starts a new design. */
  continues?: string,
): Promise<SaveOutcome> {
  const result = await saveDesign(
    {
      pattern,
      profileName: profile.name,
      metadata: form.metadata,
      note: form.note,
      ...(continues === undefined ? {} : { continues }),
    },
    deps,
  );
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, id: result.value, label: savedLabel(form.metadata, untitled) };
}

export type OpenOutcome = { ok: true; id: string; pattern: Pattern } | { ok: false; failure: ArchiveFailure };

export async function runOpen(id: string, deps?: ArchiveDeps): Promise<OpenOutcome> {
  const result = await getDesign(id, deps);
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, id, pattern: result.value.pattern };
}

export type RestoreOutcome =
  | { ok: true; id: string; pattern: Pattern; metadata: Metadata }
  | { ok: false; failure: ArchiveFailure };
/** Reads one version to load as the open design. It writes nothing, so every stored version stays as it is. */
export async function runRestore(id: string, deps?: ArchiveDeps): Promise<RestoreOutcome> {
  const result = await getDesign(id, deps);
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, id, pattern: result.value.pattern, metadata: result.value.metadata };
}
/** Deletes one version, then reads the list again so the screen shows what is stored. */
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
  /** True while the file is being prepared; a WeftProgress shows once it has run for 300 ms. */
  exporting?: boolean;
  /** True while the design is being written to the archive; a WeftProgress shows once it has run for 300 ms. */
  saving?: boolean;
  /** Decides when a started operation has run long enough to show progress. Tests pass one driven by a fake clock; the screen uses `useAfterDelay`. */
  afterDelay?: (active: boolean) => boolean;
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
  /** The version history controls. All optional, so a view without them is a view of single designs only. */
  language?: Language;
  /** Where the Current_Pattern came from; the save choice and "compare with the open design" depend on it. */
  origin?: PatternOrigin;
  expandedDesignId?: string | null;
  onToggleVersions?: (designId: string) => void;
  onRestore?: (id: string) => void;
  onCompare?: (first: CompareChoice, second: CompareChoice) => void;
  /** How many picks of the Current_Pattern are accepted suggestions; any makes the export say so. */
  repairedCount?: number;
  /** Repeats the operation that failed (a list refresh, or Save with the form as it is); without it the failure has no retry. */
  onRetry?: () => void;
};

/** What Keep draws. No state of its own, so tests can render every case (R5, R7, R22). */
export function KeepView(props: KeepViewProps) {
  const { profile, pattern, form, designs, pendingDeleteId, savedText, exportDone, failureKey, t } = props;
  const afterDelay = props.afterDelay ?? useAfterDelay;
  const showExporting = afterDelay(props.exporting === true);
  const showSaving = afterDelay(props.saving === true);
  const exportEnabled = profile !== null && canExport(pattern);
  const saveEnabled = profile !== null && canSave(pattern);
  const profileName = profile === null ? '' : profile.name;
  const origin: PatternOrigin = props.origin ?? { kind: 'none' };
  const language = props.language ?? 'en';
  const noop = (): void => undefined;
  const notice = profile === null ? null : <ProfileNotice profile={profile} t={t} />;
  // The export panel draws the one-line notice above its primary Button and the profile details below it, so opening
  // the details does not push the Button out of view (R10.7, R23.7).
  const exportNotice = profile === null ? null : <ProfileNotice profile={profile} t={t} part="notice" />;
  const exportDetails = profile === null ? null : <ProfileNotice profile={profile} t={t} part="details" />;

  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.keep')}
      </h2>

      <ScreenIntro purpose={t('keep.purpose')} next={t('keep.nextStep')} />

      {pattern.length === 0 ? (
        <Panel className={styles.block}>
          <p className={styles.emptyText}>{t('keep.empty')}</p>
        </Panel>
      ) : null}
      {failureKey === null ? null : (
        <StateMessage
          variant="error"
          message={t(failureKey)}
          t={t}
          retry={props.onRetry === undefined ? undefined : { label: t('state.retry'), onRetry: props.onRetry }}
        />
      )}

      <Panel as="section" aria-labelledby="keep-export-title" className={styles.panel}>
        <h3 id="keep-export-title" className={styles.sectionTitle}>
          {t('keep.export.heading')}
        </h3>
        <p>{t('keep.export.untested')}</p>
        {exportNotice}
        <Button variant="primary" disabled={!exportEnabled} onClick={props.onExport}>
          {t('keep.export.button')}
        </Button>
        {showExporting ? <WeftProgress text={t('progress.exporting')} /> : null}
        {(props.repairedCount ?? 0) > 0 ? <p>{t('keep.export.guesses')}</p> : null}
        {exportDone ? (
          <Notice variant="success" word={t('notice.success')}>
            {t('keep.export.done')}
          </Notice>
        ) : null}
        {exportDetails}
      </Panel>

      <Panel as="section" aria-labelledby="keep-save-title" className={styles.panel}>
        <h3 id="keep-save-title" className={styles.sectionTitle}>
          {t('keep.save.heading')}
        </h3>
        <Field label={t('keep.field.name')} className={styles.field}>
          <input
            type="text"
            value={form.metadata.name}
            onChange={(event) => props.onFormAction({ type: 'set-field', field: 'name', value: event.currentTarget.value })}
          />
        </Field>
        {notice}
        <Button disabled={!saveEnabled} onClick={props.onSave}>
          {t('keep.save.button')}
        </Button>
        {showSaving ? <WeftProgress text={t('progress.saving')} /> : null}
        <p className={styles.legal}>{t('keep.save.legal')}</p>
        {savedText === null ? null : (
          <Notice variant="success" word={t('notice.success')}>
            <p id="keep-saved" tabIndex={-1} className={styles.done}>
              {savedText}
            </p>
          </Notice>
        )}
      </Panel>

      {/* The export choices and the other details of the design: collapsed on arrival, so the name, Save and export stay in view. */}
      <div className={styles.more}>
        <Disclosure label={t('disclosure.more')}>
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
          <div className={styles.fields}>
            {MORE_FIELDS.map((field) => (
              <Field key={field} label={t(`keep.field.${field}`)} className={styles.field}>
                {field === 'notes' ? (
                  <textarea
                    rows={3}
                    value={form.metadata[field]}
                    onChange={(event) => props.onFormAction({ type: 'set-field', field, value: event.currentTarget.value })}
                  />
                ) : (
                  <input
                    type="text"
                    value={form.metadata[field]}
                    onChange={(event) => props.onFormAction({ type: 'set-field', field, value: event.currentTarget.value })}
                  />
                )}
              </Field>
            ))}
          </div>
          <Field label={t('keep.save.note')}>
            <input
              type="text"
              maxLength={NOTE_MAX}
              value={form.note}
              onChange={(event) => props.onFormAction({ type: 'set-note', value: event.currentTarget.value })}
            />
          </Field>
          {origin.kind !== 'archive' ? null : (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{t('keep.save.mode.legend')}</legend>
              {(['version', 'design'] as const).map((mode) => (
                <label key={mode} className={styles.choice}>
                  <input
                    type="radio"
                    name="keep-save-mode"
                    className={styles.radio}
                    value={mode}
                    checked={form.saveMode === mode}
                    onChange={() => props.onFormAction({ type: 'set-save-mode', mode })}
                  />
                  <span>{t(`keep.save.mode.${mode}`)}</span>
                </label>
              ))}
            </fieldset>
          )}
        </Disclosure>
      </div>

      <Panel as="section" aria-labelledby="keep-list-title" className={styles.panel}>
        <h3 id="keep-list-title" tabIndex={-1} className={styles.sectionTitle}>
          {t('keep.list.heading')}
        </h3>
        {designs !== null && designs.length === 0 ? (
          <StateMessage variant="empty" message={t('keep.list.empty')} next={t('keep.list.empty.next')} t={t} />
        ) : null}
        {designs === null || designs.length === 0 ? null : (
          <ul className={styles.list}>
            {groupDesigns(designs).map((group) => (
              <DesignEntry
                key={group.designId}
                group={group}
                profileName={profileName}
                origin={origin}
                language={language}
                expanded={props.expandedDesignId === group.designId}
                pendingDeleteId={pendingDeleteId}
                t={t}
                onToggle={props.onToggleVersions ?? noop}
                onOpen={props.onOpen}
                onRestore={props.onRestore ?? noop}
                onCompare={props.onCompare ?? noop}
                onDeleteRequest={props.onDeleteRequest}
                onDeleteConfirm={props.onDeleteConfirm}
                onDeleteCancel={props.onDeleteCancel}
              />
            ))}
          </ul>
        )}
      </Panel>
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
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failureKey, setFailureKey] = useState<string | null>(null);
  /** What a retry repeats for the failure shown: the list refresh or Save. Other failures have no retry. */
  const [retryKind, setRetryKind] = useState<'refresh' | 'save' | null>(null);
  const [expandedDesignId, setExpandedDesignId] = useState<string | null>(null);
  const returnFocusRef = useRef<string | null>(null);
  const focusSavedRef = useRef(false);

  const refresh = useCallback(async (): Promise<boolean> => {
    const listed = await listDesigns(archiveDeps);
    if (listed.ok) {
      setDesigns(listed.value);
      return true;
    }
    setDesigns(null);
    setFailureKey(archiveFailureKey(listed.failure));
    setRetryKind('refresh');
    return false;
  }, [archiveDeps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Repeats the operation that failed. A list refresh only reads; a failed Save wrote nothing, so a repeat cannot save twice.
  const onRetry = (): void => {
    if (retryKind === 'save') {
      onSave();
    } else if (retryKind === 'refresh') {
      void refresh().then((ok) => {
        if (ok) setFailureKey(null);
      });
    }
  };

  // Focus follows the action: the saved text after a save, the list row's Delete button or the list heading after a confirmation closes.
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
    if (profile === null || exporting) return;
    setExporting(true);
    // Yield once so the browser can paint the progress before the file is built; the work itself is unchanged.
    void new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
      const outcome = runExport(profile, pattern, form.options, downloadDeps);
      setExporting(false);
      if (outcome.ok) {
        setFailureKey(null);
        setExportDone(true);
        dispatch({ type: 'announce', kind: 'confirmation', messageKey: 'keep.export.done' });
      } else {
        const key = exportFailureKey(outcome.failure);
        setFailureKey(key);
        setRetryKind(null);
        dispatch({ type: 'announce', kind: 'error', messageKey: key });
      }
    });
  };

  const onSave = (): void => {
    if (profile === null || saving) return;
    setSavedText(null);
    setSaving(true);
    const origin = state.current.origin;
    const continues = continuesId(form, origin);
    // Picks that are suggested guesses are named in the design's notes; the typed notes stay as they are in the form.
    const toSave = withGuessesLine(form, state.repairs.picks, t);
    void runSave(profile, pattern, toSave, t('keep.untitled'), archiveDeps, continues).then(async (outcome) => {
      setSaving(false);
      if (outcome.ok) {
        setFailureKey(null);
        focusSavedRef.current = true;
        setSavedText(t(continues === undefined ? 'keep.saved' : 'keep.saved.version', { name: outcome.label }));
        dispatch({ type: 'mark-saved', id: outcome.id });
        if (origin.kind === 'archive') {
          // The saved version is now the open design, so the next save continues from it.
          dispatch({ type: 'set-archive-origin', id: outcome.id });
          dispatchForm({ type: 'set-note', value: '' });
          dispatchForm({ type: 'set-save-mode', mode: 'version' });
          setExpandedDesignId(null);
        }
        await refresh();
      } else {
        // The form is not touched: what the user typed stays (R7.4).
        const { announce } = afterSaveFailure(form, outcome.failure);
        setFailureKey(announce.messageKey);
        setRetryKind('save');
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
        setRetryKind(null);
        dispatch({ type: 'announce', kind: 'error', messageKey: key });
      }
    });
  };

  const onRestore = (id: string): void => {
    void runRestore(id, archiveDeps).then((outcome) => {
      if (outcome.ok) {
        setFailureKey(null);
        dispatch({ type: 'restore-saved', id: outcome.id, pattern: outcome.pattern });
        dispatchForm({ type: 'set-metadata', metadata: outcome.metadata });
        dispatchForm({ type: 'set-save-mode', mode: 'version' });
        focusSavedRef.current = true;
        setSavedText(t('keep.version.restored'));
      } else {
        const key = archiveFailureKey(outcome.failure);
        setFailureKey(key);
        setRetryKind(null);
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
        setRetryKind(null);
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
      exporting={exporting}
      saving={saving}
      failureKey={failureKey}
      onRetry={retryKind === null ? undefined : onRetry}
      t={t}
      onFormAction={dispatchForm}
      onExport={onExport}
      onSave={onSave}
      onOpen={onOpen}
      language={state.language}
      origin={state.current.origin}
      repairedCount={state.repairs.picks.length}
      expandedDesignId={expandedDesignId}
      onToggleVersions={(designId) => setExpandedDesignId((current) => (current === designId ? null : designId))}
      onRestore={onRestore}
      onCompare={(first, second) => dispatch({ type: 'compare-versions', first, second })}
      onDeleteRequest={setPendingDeleteId}
      onDeleteConfirm={onDeleteConfirm}
      onDeleteCancel={() => {
        returnFocusRef.current = pendingDeleteId;
        setPendingDeleteId(null);
      }}
    />
  );
}
