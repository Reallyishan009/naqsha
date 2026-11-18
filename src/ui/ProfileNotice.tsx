import type { CardProfile } from '../codec/index.ts';
import type { Translate } from './i18n/messages.ts';
import { profileNotice } from './profile/notice.ts';
import styles from './ProfileNotice.module.css';

export type ProfileNoticeProps = { profile: CardProfile; t: Translate };

/**
 * Shows the profile name always, and the Unverified_Profile notice when the status says so (R22.1 to R22.5).
 * The notice is plain content: no live region, so nothing is announced on load (R22.10).
 */
export function ProfileNotice({ profile, t }: ProfileNoticeProps) {
  const notice = profileNotice(profile);
  return (
    <div className={styles.profile}>
      <p className={styles.name}>
        <span className={styles.nameLabel}>{t('profile.name')}</span> <span>{profile.name}</span>
      </p>
      {notice === null ? null : (
        <div className={styles.notice}>
          <span className={styles.badge}>
            <span aria-hidden="true" className={styles.icon}>
              !
            </span>{' '}
            {t('notice.badge')}
          </span>
          <p className={styles.sentence}>{t('notice.unverifiedProfile')}</p>
          <p className={styles.statusText}>{notice.statusText}</p>
        </div>
      )}
    </div>
  );
}
