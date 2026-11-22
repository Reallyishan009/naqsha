import type { ReactNode } from 'react';
import type { Translate } from '../i18n/messages.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { Notice } from './Notice.tsx';
import type { NoticeVariant } from './Notice.tsx';

export type StateRetry = {
  /** The text of the retry control, already translated (usually `state.retry`). */
  label: string;
  onRetry: () => void;
};

type Common = {
  /** What happened or what is missing, already translated. */
  message: string;
  retry?: StateRetry;
  t: Translate;
};

export type StateMessageProps =
  | (Common & {
      /** A Notice. The word comes from `notice.<variant>`. */
      variant: NoticeVariant;
      /** What the weaver can do, as the last sentence. */
      next?: string;
      /** Defaults to `alert` for `error` only. `null` gives no role (the caller announces the message itself). */
      role?: 'alert' | 'status' | null;
    })
  | (Common & {
      /** An empty state Panel. */
      variant: 'empty';
      next: string;
      illustration?: ReactNode;
    });

/** A Notice or an EmptyState for one situation, with an optional retry that is a secondary Button of at least 48 px. */
export function StateMessage(props: StateMessageProps) {
  const { message, retry, t } = props;
  const action =
    retry === undefined ? undefined : (
      <Button variant="secondary" onClick={retry.onRetry}>
        {retry.label}
      </Button>
    );
  if (props.variant === 'empty') {
    return <EmptyState illustration={props.illustration} message={message} next={props.next} action={action} />;
  }
  return (
    <Notice variant={props.variant} word={t(`notice.${props.variant}`)} role={props.role} action={action}>
      {props.next === undefined ? message : `${message} ${props.next}`}
    </Notice>
  );
}
