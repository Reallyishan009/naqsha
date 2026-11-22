import type { Translate } from '../../i18n/messages.ts';
import { Card } from '../../components/Card.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { creditFor, demoFileName, MADE_DEMO_CARDS, REAL_DEMO_CARDS, REAL_CARD_CREDITS } from '../../state/demoCards.ts';
import type { DemoImage, RealCardCredit } from '../../state/demoCards.ts';
import styles from './DemoCards.module.css';

/** What a demo press can leave on screen: the image needs a connection, or it could not be loaded. */
export type DemoNotice = 'offline' | 'failed';

export type DemoCardsProps = {
  t: Translate;
  /** Pressing a thumbnail loads that image into the Scan flow. */
  onDemo: (image: DemoImage) => void;
  notice: DemoNotice | null;
  /** True while a photo is being read; the thumbnails wait. */
  busy: boolean;
  /** The site base (`import.meta.env.BASE_URL`), joined to every image path. */
  base: string;
  credits?: readonly RealCardCredit[];
};

function Thumbnail({ image, props }: { image: DemoImage; props: DemoCardsProps }) {
  const { t, base } = props;
  const name = t(image.nameKey);
  const url = `${base}${image.path}`;
  const credit = image.group === 'real' ? creditFor(image.path, props.credits ?? REAL_CARD_CREDITS) : undefined;
  return (
    <li className={styles.item}>
      <button type="button" className={styles.thumb} disabled={props.busy} onClick={() => props.onDemo(image)} data-demo={demoFileName(image.path)}>
        <img src={url} alt={name} width={96} height={72} loading="lazy" decoding="async" className={styles.image} />
        <span aria-hidden="true" className={styles.name}>{name}</span>
      </button>
      {credit === undefined ? null : (
        <p className={styles.credit}>
          {t('scan.demo.credit', { author: credit.author, licence: credit.licenceName })}
        </p>
      )}
      <a className={styles.download} href={url} download={demoFileName(image.path)} aria-label={t('scan.demo.download', { name })}>
        {t('scan.demo.downloadShort')}
      </a>
    </li>
  );
}

/**
 * The Demo cards of the Scan screen: images a judge can press instead of photographing a card. A press goes through
 * the same code path as the file input; this component only draws the thumbnails and says what a press cannot load.
 */
export function DemoCards(props: DemoCardsProps) {
  const { t } = props;
  return (
    <Card as="div" title={t('scan.demo.title')} titleAs="h3" chips={[t('scan.demo.chip')]} className={styles.card}>
      <h4 className={styles.group}>{t('scan.demo.made.heading')}</h4>
      <ul className={styles.list}>
        {MADE_DEMO_CARDS.map((image) => (
          <Thumbnail key={image.path} image={image} props={props} />
        ))}
      </ul>
      <p className={styles.note}>{t('scan.demo.made.note')}</p>
      <h4 className={styles.group}>{t('scan.demo.real.heading')}</h4>
      <p className={styles.note}>{t('scan.demo.real.note')}</p>
      <ul className={styles.list}>
        {REAL_DEMO_CARDS.map((image) => (
          <Thumbnail key={image.path} image={image} props={props} />
        ))}
      </ul>
      {props.notice === null ? null : (
        <StateMessage
          variant="warning"
          role="status"
          message={t(props.notice === 'offline' ? 'scan.demo.needsConnection' : 'scan.demo.loadFailed')}
          t={t}
        />
      )}
    </Card>
  );
}
