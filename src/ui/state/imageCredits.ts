import imageCreditsMarkdown from '../../../docs/IMAGE_CREDITS.md?raw';

/** One line of the table in docs/IMAGE_CREDITS.md: the photo, its author and the licence it is used under. */
export type ImageCredit = {
  /** The names of the files in public/photos that this line covers. */
  files: readonly string[];
  title: string;
  author: string;
  licenceName: string;
  licenceUrl: string;
  sourceUrl: string;
};

/** `[text](url)`; the url may itself hold parentheses, so it runs to the last closing one. */
const LINK = /^\[([^\]]+)\]\((.+)\)$/;
const FILE_NAME = /`([^`]+)`/g;

function cells(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return undefined;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * The credits in the markdown table of docs/IMAGE_CREDITS.md. A line counts when it has five cells, at least one
 * file name in backticks, and a link in both the Licence and the Source cell. Every other line (the heading, the
 * header line, the separator line, the paragraphs) is skipped, so the function never throws.
 */
export function parseImageCredits(markdown: string): ImageCredit[] {
  const credits: ImageCredit[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const fields = cells(line);
    if (fields === undefined || fields.length !== 5) continue;
    const [fileCell, title, author, licenceCell, sourceCell] = fields as [string, string, string, string, string];
    const files = [...fileCell.matchAll(FILE_NAME)].map((match) => match[1] as string);
    const licence = LINK.exec(licenceCell);
    const source = LINK.exec(sourceCell);
    if (files.length === 0 || title === '' || author === '' || licence === null || source === null) continue;
    credits.push({
      files,
      title,
      author,
      licenceName: licence[1] as string,
      licenceUrl: licence[2] as string,
      sourceUrl: source[2] as string,
    });
  }
  return credits;
}

/** The credits of the photos in public/photos, read from docs/IMAGE_CREDITS.md when the app is built. */
export const IMAGE_CREDITS: readonly ImageCredit[] = parseImageCredits(imageCreditsMarkdown);
