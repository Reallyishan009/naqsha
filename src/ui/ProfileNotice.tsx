import type { CardProfile } from '../codec/index.ts';
import type { Translate } from './i18n/messages.ts';
import { Disclosure } from './components/Disclosure.tsx';
import { profileNotice } from './profile/notice.ts';
import styles from './ProfileNotice.module.css';

export type ProfileNoticeProps = {
  profile: CardProfile;
  t: Translate;
  /**
   * `all` (the default) draws the whole notice. A Screen whose primary Button must stay in view when the details open
   * draws `notice` (the one-line notice, or the name when the profile has no status) above the Button and `details`
   * (the name and the Disclosure) below it, so opening the details never pushes the Button down.
   */
  part?: 'all' | 'notice' | 'details';
};

/**
 * Shows the profile name always, and the Unverified_Profile notice when the status says so (R22.1 to R22.5).
 * The one-line notice (word, icon and sentence) is always visible. The profile's status text is the detail, and sits
 * in a Disclosure that is collapsed by default (R10.4). The Disclosure is named by the profile name rather than "More", so the
 * "More" of the Keep and Scan screens stays the only one with that name; the label "Card profile:" stands above it.
 * The notice is plain content: no live region, so nothing is announced on load (R22.10).
 */
export function ProfileNotice({ profile, t, part = 'all' }: ProfileNoticeProps) {
  const notice = profileNotice(profile);
  const nameLabel = t('profile.name');
  if (notice === null) {
    if (part === 'details') return null;
    return (
      <div className={styles.profile}>
        <p className={styles.name}>
          <span className={styles.nameLabel}>{nameLabel}</span> <span>{profile.name}</span>
        </p>
      </div>
    );
  }
  return (
    <div className={styles.profile}>
      {part === 'details' ? null : (
        <div className={styles.notice}>
          <p className={styles.sentence}>
            <span className={styles.badge}>
              <span aria-hidden="true" className={styles.icon}>
                !
              </span>{' '}
              {t('notice.badge')}
            </span>{' '}
            {t('notice.unverifiedProfile')}
          </p>
        </div>
      )}
      {part === 'notice' ? null : (
        <>
          <p className={styles.name}>
            <span className={styles.nameLabel}>{nameLabel}</span>
          </p>
          <Disclosure label={profile.name}>
            <p className={styles.statusText}>{notice.statusText}</p>
          </Disclosure>
        </>
      )}
    </div>
  );
}
