import realCardCreditsMarkdown from '../../../public/demo/real-cards/CREDITS.md?raw';

/** One demo card picture: an image in public/demo that the Scan screen can load as if it were a chosen photo. */
export type DemoImage = {
  /** The path under the site base, for example `demo/cards/card-1-clean.png`. */
  path: string;
  /** The translation key of the name shown under the thumbnail. */
  nameKey: string;
  /** `made` pictures were drawn by Naqsha's own code; `real` are photographs of real cards. */
  group: 'made' | 'real';
};

/** The demo cards made by Naqsha, in the order they are shown. The last one has no card in it and is meant to fail. */
export const MADE_DEMO_CARDS: readonly DemoImage[] = [
  { path: 'demo/cards/card-1-clean.png', nameKey: 'scan.demo.name.clean1', group: 'made' },
  { path: 'demo/cards/card-2-clean.png', nameKey: 'scan.demo.name.clean2', group: 'made' },
  { path: 'demo/cards/card-3-clean.png', nameKey: 'scan.demo.name.clean3', group: 'made' },
  { path: 'demo/cards/card-1-tilted.png', nameKey: 'scan.demo.name.tilted', group: 'made' },
  { path: 'demo/cards/card-1-noisy.png', nameKey: 'scan.demo.name.noisy', group: 'made' },
  { path: 'demo/cards/card-1-noisy-tilted.png', nameKey: 'scan.demo.name.noisyTilted', group: 'made' },
  { path: 'demo/cards/card-blank-should-fail.png', nameKey: 'scan.demo.name.blank', group: 'made' },
];

/** The photographs of real cards, in the order they are shown. */
export const REAL_DEMO_CARDS: readonly DemoImage[] = [
  { path: 'demo/real-cards/real-card-single-1-cc0.jpg', nameKey: 'scan.demo.name.single1', group: 'real' },
  { path: 'demo/real-cards/real-card-single-2-cc0.jpg', nameKey: 'scan.demo.name.single2', group: 'real' },
  { path: 'demo/real-cards/real-card-single-3-cc0.jpg', nameKey: 'scan.demo.name.single3', group: 'real' },
  { path: 'demo/real-cards/real-card-single-4-cc0.jpg', nameKey: 'scan.demo.name.single4', group: 'real' },
  { path: 'demo/real-cards/real-card-chain-cc0.jpg', nameKey: 'scan.demo.name.chain', group: 'real' },
  { path: 'demo/real-cards/real-card-bradford-chain-ccby.jpg', nameKey: 'scan.demo.name.bradfordChain', group: 'real' },
  { path: 'demo/real-cards/real-card-bradford-stack-ccby.jpg', nameKey: 'scan.demo.name.bradfordStack', group: 'real' },
  { path: 'demo/real-cards/real-card-sari-pattern-ccby.jpg', nameKey: 'scan.demo.name.sari', group: 'real' },
];

/** The file name at the end of a path. */
export function demoFileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** One line of the table in public/demo/real-cards/CREDITS.md. */
export type RealCardCredit = {
  /** The names of the files that this line covers (a range such as `single-1..4` is expanded). */
  files: readonly string[];
  author: string;
  /** The licence as written, for example `CC BY 3.0` or `CC0 (no rights reserved)`. */
  licenceName: string;
  /** The link of the licence, or undefined when the licence is written as plain text. */
  licenceUrl: string | undefined;
};

const LINK = /^\[([^\]]+)\]\((.+)\)$/;

function tableFields(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return undefined;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((field) => field.trim());
}

/** A file field may name several files, and may write `name-1..4-x.jpg` for the files numbered 1 to 4. */
function expandFiles(field: string): string[] {
  const files: string[] = [];
  for (const raw of field.split(',')) {
    const token = raw.replace(/\([^)]*\)/g, '').replace(/`/g, '').trim();
    const range = /^(.*?)(\d+)\.\.(\d+)(.*)$/.exec(token);
    if (range === null) {
      if (token !== '') files.push(token);
      continue;
    }
    const from = Number(range[2]);
    const to = Number(range[3]);
    for (let number = from; number <= to; number += 1) files.push(`${range[1]}${number}${range[4]}`);
  }
  return files;
}

/**
 * The credits in the markdown table of CREDITS.md (four fields: File, Source, Author, Licence). A line that is not a
 * table line with four fields, with a file ending in `.jpg`, an author and a licence is skipped, so it never throws.
 */
export function parseRealCardCredits(markdown: string): RealCardCredit[] {
  const credits: RealCardCredit[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const fields = tableFields(line);
    if (fields === undefined || fields.length !== 4) continue;
    const [fileField, , author, licenceField] = fields as [string, string, string, string];
    const files = expandFiles(fileField).filter((file) => file.endsWith('.jpg'));
    if (files.length === 0 || author === '' || licenceField === '') continue;
    const link = LINK.exec(licenceField);
    credits.push({
      files,
      author,
      licenceName: link === null ? licenceField : (link[1] as string),
      licenceUrl: link === null ? undefined : (link[2] as string),
    });
  }
  return credits;
}

/** The credits of the real card photos, read from public/demo/real-cards/CREDITS.md when the app is built. */
export const REAL_CARD_CREDITS: readonly RealCardCredit[] = parseRealCardCredits(realCardCreditsMarkdown);

/** The credit of one real card photo, or undefined. */
export function creditFor(path: string, credits: readonly RealCardCredit[] = REAL_CARD_CREDITS): RealCardCredit | undefined {
  const name = demoFileName(path);
  return credits.find((credit) => credit.files.includes(name));
}

/** What fetching a demo image gave: the image as a File, or the reason there is none. Never throws. */
export type DemoFetchResult = { kind: 'file'; file: File } | { kind: 'offline' } | { kind: 'failed' };

/**
 * Fetches a demo image and wraps it in a File named after the image, so it enters the Scan flow as a chosen photo does.
 * A fetch that fails while the browser is offline is `offline` (the image was not cached); any other failure is `failed`.
 */
export async function fetchDemoImage(
  url: string,
  name: string,
  fetchImage: (url: string) => Promise<Response>,
  isOnline: () => boolean,
): Promise<DemoFetchResult> {
  try {
    const response = await fetchImage(url);
    if (!response.ok) return isOnline() ? { kind: 'failed' } : { kind: 'offline' };
    const blob = await response.blob();
    return { kind: 'file', file: new File([blob], name, { type: blob.type }) };
  } catch {
    return isOnline() ? { kind: 'failed' } : { kind: 'offline' };
  }
}
