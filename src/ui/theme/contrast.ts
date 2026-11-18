export type ThemeName = 'day' | 'night';

export type TokenName =
  | 'ground'
  | 'surface'
  | 'ink'
  | 'ink-soft'
  | 'line'
  | 'card'
  | 'hole'
  | 'zari'
  | 'madder'
  | 'indigo'
  | 'leaf';

/** The colour tokens of docs/DESIGN_BRIEF.md. `tokens.css` must hold the same values (a test checks it). */
export const THEME_TOKENS: Readonly<Record<ThemeName, Readonly<Record<TokenName, string>>>> = {
  day: {
    ground: '#F6EFE0',
    surface: '#FFFBF2',
    ink: '#2A1F14',
    'ink-soft': '#6B5B48',
    line: '#D9CBB0',
    card: '#D8B67A',
    hole: '#1B140C',
    zari: '#B0800A', // brief value #B8860B fails the focus pair (2.84:1 on ground); see docs/BUILD_LOG.md
    madder: '#9C2B2B',
    indigo: '#27306B',
    leaf: '#2F6B4F',
  },
  night: {
    ground: '#14122B',
    surface: '#1E1B3D',
    ink: '#F1E8D5',
    'ink-soft': '#B4A9C8',
    line: '#35315E',
    card: '#C9A461',
    hole: '#07061A',
    zari: '#E3B341',
    madder: '#E0625A',
    indigo: '#8FA3FF',
    leaf: '#6FCF9B',
  },
};

export type TokenPair = {
  theme: ThemeName;
  foreground: TokenName;
  background: TokenName;
  /** 4.5 for text (R14.7), 3 for the focus indicator (R14.3). */
  minimum: number;
};

const TEXT_ON_GROUND_AND_SURFACE: ReadonlyArray<TokenName> = ['ink', 'ink-soft', 'madder', 'indigo', 'leaf'];

function pairsFor(theme: ThemeName, buttonText: TokenName): TokenPair[] {
  const pairs: TokenPair[] = [];
  for (const foreground of TEXT_ON_GROUND_AND_SURFACE) {
    pairs.push({ theme, foreground, background: 'ground', minimum: 4.5 });
    pairs.push({ theme, foreground, background: 'surface', minimum: 4.5 });
  }
  pairs.push({ theme, foreground: buttonText, background: 'zari', minimum: 4.5 });
  pairs.push({ theme, foreground: 'zari', background: 'ground', minimum: 3 });
  pairs.push({ theme, foreground: 'zari', background: 'surface', minimum: 3 });
  return pairs;
}

/** Text pairs (4.5) and the focus pairs (3) for both themes. Text on a zari button is ink (day) or hole (night). */
export const TOKEN_PAIRS: ReadonlyArray<TokenPair> = [...pairsFor('day', 'ink'), ...pairsFor('night', 'hole')];

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (match === null) throw new RangeError(`not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => channel(Number.parseInt(part as string, 16)));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

/** WCAG 2.x contrast ratio, between 1 and 21, symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
