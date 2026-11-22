import licenceText from '../../../LICENSE?raw';

/** The repository of the app, the `origin` remote with the `.git` taken off (package.json holds the same address under `repository`). */
export const REPOSITORY_URL = 'https://github.com/Reallyishan009/naqsha';

/** The name of the licence a LICENSE file states: its first line that holds text ("MIT License"), or an empty string when there is none. */
export function licenceNameOf(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed !== '') return trimmed;
  }
  return '';
}

/** The licence of the app, read from the LICENSE file when the app is built. */
export const REPOSITORY_LICENCE: string = licenceNameOf(licenceText);

/** One font family the app ships in `public/fonts`, with whom it is by and the licence text that travels with it. */
export type FontCredit = {
  /** The family as it is written for readers ("IBM Plex Mono"). */
  family: string;
  /** The designer or foundry, as in the README's font table. */
  foundry: string;
  /** The short name of the licence. */
  licence: string;
  /** The licence text in `public/fonts` (the same file that README names). */
  licenceFile: string;
};

/**
 * The font families of `public/fonts`, one entry each. A test compares their number and their licence files with the
 * files in that folder, so a font added there cannot be left out of the footer.
 */
export const FONT_CREDITS: readonly FontCredit[] = [
  { family: 'Rozha One', foundry: 'Indian Type Foundry', licence: 'SIL OFL 1.1', licenceFile: 'RozhaOne-OFL.txt' },
  { family: 'Hind', foundry: 'Indian Type Foundry', licence: 'SIL OFL 1.1', licenceFile: 'Hind-OFL.txt' },
  { family: 'IBM Plex Mono', foundry: 'IBM Corp.', licence: 'SIL OFL 1.1', licenceFile: 'IBMPlexMono-OFL.txt' },
  { family: 'Newsreader', foundry: 'Production Type', licence: 'SIL OFL 1.1', licenceFile: 'Newsreader-OFL.txt' },
];
