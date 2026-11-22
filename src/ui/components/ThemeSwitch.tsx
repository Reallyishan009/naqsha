import type { ThemeName } from '../theme/contrast.ts';
import styles from './ThemeSwitch.module.css';

export type ThemeSwitchProps = {
  theme: ThemeName;
  /** The accessible name, already translated: it says which loom the press switches to ("Switch to night loom"). */
  label: string;
  onChoose: (theme: ThemeName) => void;
};

/** A sun (a disc with rays) in Day loom and a moon (a crescent) in Night loom: different shapes, so colour is not the signal. */
function ThemeIcon({ theme }: { theme: ThemeName }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon={theme === 'night' ? 'moon' : 'sun'}>
      {theme === 'night' ? (
        <path d="M20,14.5 A9,9 0 1 1 9.5,4 A7,7 0 0 0 20,14.5 Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="4.5" />
          <line x1="12" y1="19.5" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4.5" y2="12" />
          <line x1="19.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6.7" y2="6.7" />
          <line x1="17.3" y1="17.3" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6.7" y2="17.3" />
          <line x1="17.3" y1="6.7" x2="19.4" y2="4.6" />
        </>
      )}
    </svg>
  );
}

/**
 * The theme switch: one icon-only `role="switch"` button, at least 48 by 48 px. `aria-checked` is true in the Night loom.
 * Its accessible name says what a press does ("Switch to night loom" in Day loom, "Switch to day loom" in Night loom).
 */
export function ThemeSwitch({ theme, label, onChoose }: ThemeSwitchProps) {
  const night = theme === 'night';
  return (
    <button type="button" role="switch" aria-checked={night} aria-label={label} className={styles.switch} onClick={() => onChoose(night ? 'day' : 'night')}>
      <ThemeIcon theme={theme} />
    </button>
  );
}
