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
  | 'leaf'
  | 'on-zari'
  | 'on-hole'
  | 'primary'
  | 'on-primary'
  | 'accent'
  | 'eyebrow'
  | 'tint'
  | 'band'
  | 'on-band'
  | 'band-accent'
  | 'hero-tint';

/**
 * The colour tokens of docs/DESIGN_BRIEF.md (second pass). `tokens.css` must hold the same values (a test checks it).
 * Day: cream ground, forest-green ink and primary, tan accent. Night: near-black green ground, amber accent.
 */
export const THEME_TOKENS: Readonly<Record<ThemeName, Readonly<Record<TokenName, string>>>> = {
  day: {
    ground: '#F6EFE0',
    surface: '#FFFBF2',
    ink: '#183326', // forest green, near black
    'ink-soft': '#566759',
    line: '#E6DCC4', // a hairline and the Graph_Paper_Ground; soft so the ground stays calm
    card: '#D8B67A',
    hole: '#1B140C',
    zari: '#B0800A', // the focus ring and the old accent; brief value #B8860B fails the focus pair (2.84:1 on ground); see docs/BUILD_LOG.md
    madder: '#9C2B2B',
    indigo: '#27306B',
    leaf: '#2F6B4F',
    'on-zari': '#2A1F14', // text on the zari fill (a warm near black; the forest ink would fall under 4.5:1 on zari)
    'on-hole': '#F1E8D5', // text on the dark Code view panel
    primary: '#1F4D36', // deep forest green: primary Button, links
    'on-primary': '#FFFBF2', // text on a primary Button
    accent: '#8A6532', // warm tan: the italic accent word in a display heading (24 px and up)
    eyebrow: '#6E4E22', // darker tan: small letterspaced labels
    tint: '#EDE3CB', // chip and quiet fill
    band: '#1F4D36', // the deep-green band
    'on-band': '#F6EFE0',
    'band-accent': '#E2C48F', // light tan on the band
    'hero-tint': '#0F2A1E', // the deep-green tint over the Landing hero photo
  },
  night: {
    ground: '#0E1511',
    surface: '#16201A',
    ink: '#EFE8D6',
    'ink-soft': '#A3B3A7',
    line: '#1F2D24',
    card: '#C9A461',
    hole: '#070D09',
    zari: '#E3B341',
    madder: '#E0625A',
    indigo: '#8FA3FF',
    leaf: '#6FCF9B',
    'on-zari': '#070D09', // text on the zari fill (hole in Night)
    'on-hole': '#F1E8D5', // text on the dark Code view panel
    primary: '#E3B341', // amber: primary Button, links
    'on-primary': '#0B120E',
    accent: '#E3B341', // amber
    eyebrow: '#D9A83E',
    tint: '#1E2B23',
    band: '#1B3A2A',
    'on-band': '#F1EBD9',
    'band-accent': '#E3B341',
    'hero-tint': '#060D09',
  },
};

/** The smallest alpha the frosted header surface may have, so text keeps its contrast over any photo (brief.md). */
export const FROST_MIN_ALPHA = 0.85;

/**
 * The frosted surface of the header: the `surface` colour at `alpha`, in `tokens.css` as `--frost`
 * (`rgb(R G B / alpha)`; a test compares it with this). `worstBackdrop` is the colour behind the glass that
 * lowers contrast most: black under the light Day surface (its dark text loses most when the surface darkens),
 * white over the dark Night surface (its light text loses most when the surface lightens). Any real photo lies between.
 */
export const FROST: Readonly<Record<ThemeName, { alpha: number; worstBackdrop: string }>> = {
  day: { alpha: 0.95, worstBackdrop: '#000000' },
  night: { alpha: 0.95, worstBackdrop: '#FFFFFF' },
};

/** `top` laid over `bottom` at `alpha`, as the opaque `#RRGGBB` colour that results (each channel rounded). */
export function compositeOver(top: string, alpha: number, bottom: string): string {
  const parse = (hex: string): number[] => {
    const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (match === null) throw new RangeError(`not a #RRGGBB colour: ${hex}`);
    return [match[1], match[2], match[3]].map((part) => Number.parseInt(part as string, 16));
  };
  const above = parse(top);
  const below = parse(bottom);
  const mixed = above.map((value, index) => Math.round(alpha * value + (1 - alpha) * (below[index] as number)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** The opaque colour of the frosted header surface in the worst case (see FROST). */
export function frostWorstCase(theme: ThemeName): string {
  return compositeOver(THEME_TOKENS[theme].surface, FROST[theme].alpha, FROST[theme].worstBackdrop);
}

/**
 * The Landing hero: a photo under a layer of `hero-tint` at `alpha` (`--hero-tint-alpha` in tokens.css; a test compares
 * them). The text of the hero lies on that layer, so its worst case is the photo's brightest pixel, white, under the
 * tint. A second layer in Landing.module.css darkens the text side further; it only adds darkness, so it is not counted.
 */
export const HERO_TINT: Readonly<Record<ThemeName, { alpha: number; worstBackdrop: string }>> = {
  day: { alpha: 0.8, worstBackdrop: '#FFFFFF' },
  night: { alpha: 0.8, worstBackdrop: '#FFFFFF' },
};

/** The opaque colour of the hero text's ground in the worst case (see HERO_TINT). */
export function heroWorstCase(theme: ThemeName): string {
  return compositeOver(THEME_TOKENS[theme]['hero-tint'], HERO_TINT[theme].alpha, HERO_TINT[theme].worstBackdrop);
}

/**
 * The Landing's Night section: the Kanchipuram photo under a layer of `hero-tint` at `alpha` (`--night-photo-alpha` in
 * tokens.css; a test compares them), darker than the hero's. Its text lies on that layer, so its worst case is a white
 * photo pixel under the tint.
 */
export const NIGHT_PHOTO_TINT: Readonly<Record<ThemeName, { alpha: number; worstBackdrop: string }>> = {
  day: { alpha: 0.86, worstBackdrop: '#FFFFFF' },
  night: { alpha: 0.86, worstBackdrop: '#FFFFFF' },
};

/** The opaque colour of the Night section's text ground in the worst case (see NIGHT_PHOTO_TINT). */
export function nightPhotoWorstCase(theme: ThemeName): string {
  return compositeOver(THEME_TOKENS[theme]['hero-tint'], NIGHT_PHOTO_TINT[theme].alpha, NIGHT_PHOTO_TINT[theme].worstBackdrop);
}

/** A background that is a token, the frosted header surface, the Landing hero's ground or the Night section's ground (each in its worst case). */
export type PairBackground = TokenName | 'frost' | 'hero' | 'night-photo';

export type TokenPair = {
  theme: ThemeName;
  foreground: TokenName;
  background: PairBackground;
  /** 4.5 for text (R14.7), 3 for the focus indicator (R14.3) and for graphics that carry meaning. */
  minimum: number;
};

/** The `#RRGGBB` colour a pair side stands for in a theme. */
export function tokenColour(theme: ThemeName, name: PairBackground): string {
  if (name === 'frost') return frostWorstCase(theme);
  if (name === 'hero') return heroWorstCase(theme);
  if (name === 'night-photo') return nightPhotoWorstCase(theme);
  return THEME_TOKENS[theme][name];
}

const TEXT_ON_GROUND_AND_SURFACE: ReadonlyArray<TokenName> = [
  'ink',
  'ink-soft',
  'madder',
  'indigo',
  'leaf',
  'primary', // links and the primary colour as text
  'accent', // display text 24 px and up needs only 3:1; it has 4.5:1 and the pair keeps it
  'eyebrow',
];

/** Text that sits on the header glass, a chip or another quiet fill. */
const TEXT_ON_FROST: ReadonlyArray<TokenName> = ['ink', 'ink-soft', 'primary', 'indigo', 'eyebrow'];
const TEXT_ON_TINT: ReadonlyArray<TokenName> = ['ink', 'ink-soft', 'eyebrow'];

function pairsFor(theme: ThemeName): TokenPair[] {
  const pairs: TokenPair[] = [];
  for (const foreground of TEXT_ON_GROUND_AND_SURFACE) {
    pairs.push({ theme, foreground, background: 'ground', minimum: 4.5 });
    pairs.push({ theme, foreground, background: 'surface', minimum: 4.5 });
  }
  for (const foreground of TEXT_ON_TINT) pairs.push({ theme, foreground, background: 'tint', minimum: 4.5 });
  // The accent word of a section heading on the tinted band of the Landing (display text, 24 px and up).
  pairs.push({ theme, foreground: 'accent', background: 'tint', minimum: 3 });
  // Text on a zari fill, a primary Button, the deep-green band, and on the dark Code view panel.
  pairs.push({ theme, foreground: 'on-zari', background: 'zari', minimum: 4.5 });
  pairs.push({ theme, foreground: 'on-primary', background: 'primary', minimum: 4.5 });
  // The current link of the header: on-primary text on the tan accent pill.
  pairs.push({ theme, foreground: 'on-primary', background: 'accent', minimum: 4.5 });
  pairs.push({ theme, foreground: 'on-band', background: 'band', minimum: 4.5 });
  pairs.push({ theme, foreground: 'band-accent', background: 'band', minimum: 4.5 });
  pairs.push({ theme, foreground: 'on-hole', background: 'hole', minimum: 4.5 });
  // The frosted header, at its worst case (FROST): text, and the focus ring drawn over it.
  for (const foreground of TEXT_ON_FROST) pairs.push({ theme, foreground, background: 'frost', minimum: 4.5 });
  pairs.push({ theme, foreground: 'zari', background: 'frost', minimum: 3 });
  // The Landing hero text, on the tinted photo at its worst case (HERO_TINT): light text, the tan accent word, and the
  // tan focus ring the hero uses in place of zari (3:1 is enough for the ring; the pair keeps 4.5).
  pairs.push({ theme, foreground: 'on-band', background: 'hero', minimum: 4.5 });
  pairs.push({ theme, foreground: 'band-accent', background: 'hero', minimum: 4.5 });
  // The Night section's text on its darker tinted photo at the worst case (NIGHT_PHOTO_TINT): light text, the tan eyebrow
  // and accent word, and the tan focus ring the section uses.
  pairs.push({ theme, foreground: 'on-band', background: 'night-photo', minimum: 4.5 });
  pairs.push({ theme, foreground: 'band-accent', background: 'night-photo', minimum: 4.5 });
  // The "Bring a card" band uses on-band and band-accent on band (listed above), and its secondary Buttons are their own surface.
  // Focus indicator against the page and the Panel.
  pairs.push({ theme, foreground: 'zari', background: 'ground', minimum: 3 });
  pairs.push({ theme, foreground: 'zari', background: 'surface', minimum: 3 });
  // Graphics that carry meaning: punched holes on the card, the card outline, control borders and a primary Button's edge.
  pairs.push({ theme, foreground: 'hole', background: 'card', minimum: 3 });
  pairs.push({ theme, foreground: 'ink-soft', background: 'ground', minimum: 3 });
  pairs.push({ theme, foreground: 'ink-soft', background: 'surface', minimum: 3 });
  pairs.push({ theme, foreground: 'primary', background: 'ground', minimum: 3 });
  pairs.push({ theme, foreground: 'primary', background: 'surface', minimum: 3 });
  return pairs;
}

/** Text pairs (4.5), the focus pairs (3) and the graphic pairs (3) for both themes. */
export const TOKEN_PAIRS: ReadonlyArray<TokenPair> = [...pairsFor('day'), ...pairsFor('night')];

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

/**
 * A ratio as text with two decimals, truncated and never rounded up, so a ratio below its
 * minimum cannot be shown as meeting it. Works on the shortest decimal text of the number, so
 * 4.55 gives "4.55" and not "4.54" (4.55 * 100 is 454.99999999999994 in floating point).
 */
export function truncateRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) throw new RangeError(`not a finite ratio: ${ratio}`);
  let text = String(Math.abs(ratio));
  if (/e/i.test(text)) text = Math.abs(ratio).toFixed(20); // exponent form: tiny or huge, never a WCAG ratio
  const [whole = '0', fraction = ''] = text.split('.');
  const sign = ratio < 0 ? '-' : '';
  return `${sign}${whole}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}
