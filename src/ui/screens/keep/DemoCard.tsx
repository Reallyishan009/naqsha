import type { Translate } from '../../i18n/messages.ts';
import { Button, buttonClassName } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { DEMO_LOOM_FILES } from '../../state/demoDesigns.ts';
import styles from './DemoCard.module.css';

export type DemoCardProps = {
  t: Translate;
  /** Saves the Diamond sample as a demo design. */
  onSave: () => void;
  /** Saves a new version of the demo design with a few punched holes changed. */
  onEdit: () => void;
  /** Both buttons wait while a demo save is running, and while there is no Card_Profile. */
  disabled: boolean;
  /** The site base (`import.meta.env.BASE_URL`), joined to the path of each loom file. */
  base: string;
};

/** The Demo card of the Keep screen: a design to keep, a version to compare, and the two loom files to download. */
export function DemoCard({ t, onSave, onEdit, disabled, base }: DemoCardProps) {
  return (
    <Card as="div" title={t('keep.demo.title')} titleAs="h4" chips={[t('demo.chip')]} className={styles.card}>
      <p className={styles.text}>{t('keep.demo.intro')}</p>
      <div className={styles.actions}>
        <Button disabled={disabled} onClick={onSave} data-demo="save">
          {t('keep.demo.save')}
        </Button>
        <Button disabled={disabled} onClick={onEdit} data-demo="edit">
          {t('keep.demo.edit')}
        </Button>
      </div>
      <h5 className={styles.group}>{t('keep.demo.loom.heading')}</h5>
      <p className={styles.text}>{t('keep.demo.loom.note')}</p>
      <ul className={styles.files}>
        {DEMO_LOOM_FILES.map((file) => (
          <li key={file.path}>
            <a
              className={buttonClassName('secondary')}
              href={`${base}${file.path}`}
              download={file.fileName}
              data-demo-file={file.fileName}
            >
              {t('keep.demo.loom.link', { name: file.fileName })}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
