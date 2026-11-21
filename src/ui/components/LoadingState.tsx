import { WeftProgress } from './WeftProgress.tsx';

export type LoadingStateProps = {
  /** What is loading, already translated. */
  text: string;
};

/**
 * The message for something that is loading, in one `role="status"` region. Mount it only while loading, so the text
 * is announced once; the Shell's own live region is the only one that stays mounted.
 */
export function LoadingState({ text }: LoadingStateProps) {
  return (
    <div role="status">
      <WeftProgress text={text} />
    </div>
  );
}
