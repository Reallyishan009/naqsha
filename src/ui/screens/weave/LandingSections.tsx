import type { Dispatch, ReactNode } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { generateSample, sampleWithLostCards } from '../../samples/sampleDesigns.ts';
import type { AppAction, Language, Screen } from '../../types.ts';
import { ArtImage } from '../../components/ArtImage.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Chip } from '../../components/Chip.tsx';
import { Photo } from '../../components/Photo.tsx';
import { Reveal } from '../../components/Reveal.tsx';
import { SectionHeader } from '../../components/SectionHeader.tsx';
import { WorksOfflineIllustration } from '../../illustrations/SpotIllustrations.tsx';
import { ART } from '../../state/art.ts';
import { splitAtAccent } from '../../state/headline.ts';
import { PHOTOS } from '../../state/photos.ts';
import styles from './LandingSections.module.css';

/** The i18n key prefix of each section: `<prefix>.eyebrow`, `.heading`, `.heading.accent` and `.subtitle`. */
export type SectionPrefix = 'landing.how' | 'landing.can' | 'landing.try';

export type SectionHeadingProps = {
  language: Language;
  t: Translate;
  prefix: SectionPrefix;
  /** The id of the heading, for the `aria-labelledby` of its section. */
  headingId: string;
};

/** The header every section of the Landing starts with: eyebrow, two-line serif heading with one accent word, one-line subtitle. */
export function SectionHeading({ language, t, prefix, headingId }: SectionHeadingProps) {
  const heading = t(`${prefix}.heading`);
  const parts = splitAtAccent(heading, t(`${prefix}.heading.accent`));
  return (
    <Reveal>
      <SectionHeader
        language={language}
        eyebrow={t(`${prefix}.eyebrow`)}
        before={parts === null ? heading : parts.before}
        accent={parts === null ? '' : parts.accent}
        after={parts === null ? '' : parts.after}
        subtitle={t(`${prefix}.subtitle`)}
        as="h3"
        headingId={headingId}
      />
    </Reveal>
  );
}

type Step = {
  id: 'card' | 'pattern' | 'cloth';
  picture: ReactNode;
  chips: readonly string[];
};

export type HowItWorksProps = { language: Language; t: Translate };

/** Section 2: three steps, a card, the design it makes and the cloth, the picture and the words changing sides from one step to the next. */
export function HowItWorks({ language, t }: HowItWorksProps) {
  const sari = PHOTOS['sari-pattern-cards'];
  const grid = ART['grid-diamond'];
  const cloth = ART['cloth-diamond'];
  const steps: readonly Step[] = [
    {
      id: 'card',
      picture: <Photo photo={sari} alt={t(sari.altKey)} lazy sizes="(min-width: 48rem) 40vw, 100vw" />,
      chips: [t('landing.how.card.chip.holes'), t('landing.how.card.chip.pick')],
    },
    {
      id: 'pattern',
      picture: <ArtImage art={grid} alt={t(grid.altKey)} lazy />,
      chips: [t('landing.how.pattern.chip.dark'), t('landing.how.pattern.chip.pale')],
    },
    {
      id: 'cloth',
      picture: <ArtImage art={cloth} alt={t(cloth.altKey)} lazy />,
      chips: [t('landing.how.cloth.chip.pick'), t('landing.how.cloth.chip.colours')],
    },
  ];
  return (
    <section aria-labelledby="landing-how-title" className={`${styles.section} ${styles.ground}`} data-landing-section="how">
      <div className={styles.container}>
        <SectionHeading language={language} t={t} prefix="landing.how" headingId="landing-how-title" />
        <ol className={styles.steps} aria-label={t('landing.steps.name')}>
          {steps.map((step, index) => (
            <Reveal as="li" key={step.id} className={styles.step} data={{ 'data-step': step.id }}>
              <div className={styles.frame}>
                {step.picture}
                <span className={styles.badge} aria-hidden="true">
                  {index + 1}
                </span>
                <ul className={styles.frameChips}>
                  {step.chips.map((chip) => (
                    <li key={chip}>
                      <Chip tone="picture">{chip}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.stepText}>
                <h4 className={styles.stepTitle}>{t(`landing.how.${step.id}.title`)}</h4>
                <p className={styles.stepBody}>{t(`landing.how.${step.id}.text`)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export type WhatYouCanDoProps = {
  language: Language;
  t: Translate;
  /** The Card_Profile once it is ready; the two cards that open a sample wait for it. */
  profile: CardProfile | null;
  dispatch: Dispatch<AppAction>;
};

type Feature = {
  id: 'read' | 'weave' | 'export' | 'keep' | 'code' | 'repair' | 'offline';
  picture: ReactNode;
  chips: readonly string[];
  /** The button under the card: its label and what it does; none for the card that only says something. */
  action: { label: string; disabled: boolean; run: () => void } | null;
};

/** Section 3: a card for each thing the app does, with a picture on top and a button to the screen where it happens. */
export function WhatYouCanDo({ language, t, profile, dispatch }: WhatYouCanDoProps) {
  const open = (screen: Screen) => () => dispatch({ type: 'navigate', screen });
  const art = (id: 'card-border' | 'chain-8' | 'grid-diamond' | 'cloth-lost') => <ArtImage art={ART[id]} alt={t(ART[id].altKey)} lazy />;
  const chain = PHOTOS['bradford-card-chain'];
  const stack = PHOTOS['bradford-card-stack'];
  const features: readonly Feature[] = [
    {
      id: 'read',
      picture: art('card-border'),
      chips: [t('landing.can.read.chip')],
      action: { label: t('landing.can.read.action'), disabled: false, run: open('scan') },
    },
    {
      id: 'weave',
      picture: art('chain-8'),
      chips: [],
      action: {
        label: t('landing.can.weave.action'),
        disabled: profile === null,
        run: () => {
          if (profile !== null) dispatch({ type: 'request-sample', design: 'diamond', pattern: generateSample(profile, 'diamond') });
        },
      },
    },
    {
      id: 'export',
      picture: art('grid-diamond'),
      chips: [t('landing.can.export.chip.one'), t('landing.can.export.chip.eight')],
      action: { label: t('landing.can.export.action'), disabled: false, run: open('keep') },
    },
    {
      id: 'keep',
      picture: <Photo photo={stack} alt={t(stack.altKey)} lazy sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw" />,
      chips: [t('landing.can.keep.chip')],
      action: { label: t('landing.can.keep.action'), disabled: false, run: open('keep') },
    },
    {
      id: 'code',
      picture: <Photo photo={chain} alt={t(chain.altKey)} lazy sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw" />,
      chips: [t('nav.advanced')],
      action: { label: t('landing.can.code.action'), disabled: false, run: open('code') },
    },
    {
      id: 'repair',
      picture: art('cloth-lost'),
      chips: [t('landing.can.repair.chip')],
      action: {
        label: t('landing.can.repair.action'),
        disabled: profile === null,
        run: () => {
          if (profile !== null) dispatch({ type: 'request-sample', design: 'diamond', pattern: sampleWithLostCards(profile) });
        },
      },
    },
    {
      id: 'offline',
      // A drawing, not a picture file: the card has no image bytes.
      picture: (
        <div className={styles.drawing}>
          <WorksOfflineIllustration />
        </div>
      ),
      chips: [t('landing.can.offline.chip')],
      action: null,
    },
  ];
  return (
    <section aria-labelledby="landing-can-title" className={`${styles.section} ${styles.tint}`} data-landing-section="what">
      <div className={styles.container}>
        <SectionHeading language={language} t={t} prefix="landing.can" headingId="landing-can-title" />
        <ul className={styles.features}>
          {features.map((feature) => (
            <Reveal as="li" key={feature.id} className={styles.feature}>
              <Card
                as="div"
                titleAs="h4"
                picture={feature.picture}
                title={t(`landing.can.${feature.id}.title`)}
                chips={feature.chips}
                action={
                  feature.action === null ? undefined : (
                    <Button disabled={feature.action.disabled} onClick={feature.action.run}>
                      {feature.action.label}
                    </Button>
                  )
                }
              >
                <p>{t(`landing.can.${feature.id}.text`)}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
