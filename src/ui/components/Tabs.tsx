import styles from './Tabs.module.css';

export type TabItem = { key: string; label: string; lang?: string };

export type TabsProps = {
  label: string;
  items: readonly TabItem[];
  current: string;
  onChoose: (key: string) => void;
};

/**
 * A group of toggle buttons (`aria-pressed`). The current choice is bold and carries a drawn check mark
 * as well as its fill, so it does not depend on colour.
 */
export function Tabs({ label, items, current, onChoose }: TabsProps) {
  return (
    <div role="group" aria-label={label} className={styles.tabs}>
      {items.map((item) => {
        const isCurrent = item.key === current;
        return (
          <button
            key={item.key}
            type="button"
            lang={item.lang}
            className={isCurrent ? `${styles.tab} ${styles.current}` : styles.tab}
            aria-pressed={isCurrent}
            onClick={() => onChoose(item.key)}
          >
            {isCurrent ? (
              <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-mark="check">
                <polyline points="2,8.5 6,12.5 14,3.5" />
              </svg>
            ) : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
