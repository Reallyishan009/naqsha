import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { CardThumb } from '../../../src/ui/screens/scan/BatchList.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

describe('punch cards drawn in the app', () => {
  it('R15.6 a card thumbnail in the batch list has round holes, peg holes and lacing holes from the Card_Profile', () => {
    const profile = demoProfile();
    const grid = generateSample(profile, 'diamond')[0]!;
    const punched = grid.flat().filter(Boolean).length;
    const html = renderToStaticMarkup(<CardThumb grid={grid} number={1} profile={profile} t={translator(DICTIONARIES, 'en')} />);
    const circles = html.match(/<circle/g)?.length ?? 0;
    expect(circles).toBe(punched + profile.pegHoles.length + profile.lacingHoles.positionsMm.length);
  });
  // Feature: app, Property 40: a card thumbnail draws every punched hole, peg hole and lacing hole
  it('R15.6 a thumbnail draws one round hole per punched hook, peg hole and lacing hole for any Card_Profile and grid', () => {
    const t = translator(DICTIONARIES, 'en');
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) => cardGridArbitrary(profile).map((grid) => ({ profile, grid }))),
        ({ profile, grid }) => {
          const punched = grid.flat().filter(Boolean).length;
          const html = renderToStaticMarkup(<CardThumb grid={grid} number={1} profile={profile} t={t} />);
          const circles = html.match(/<circle/g)?.length ?? 0;
          expect(circles).toBe(punched + profile.pegHoles.length + profile.lacingHoles.positionsMm.length);
        },
      ),
      { seed: 1506, numRuns: 100 },
    );
  });
});
