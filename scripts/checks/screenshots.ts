/** Pure parts of the screenshot command: the 24 file names and the checks on a saved set, and the 4 names of the full-page Landing set. No I/O. */

export const SCREENSHOT_VIEWS = ['weave-landing', 'weave-sample', 'weave-lost', 'keep-versions', 'scan', 'code-diff'] as const;
export const SCREENSHOT_THEMES = ['day', 'night'] as const;
export const SCREENSHOT_WIDTHS = [320, 1280] as const;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** 8 signature bytes, 4 length bytes, 4 type bytes, then the 4 width bytes of IHDR. */
const WIDTH_END = 24;

/** The 24 names `<view>-<theme>-<width>.png`, in view, then theme, then width order. */
export function screenshotNames(): string[] {
  const names: string[] = [];
  for (const view of SCREENSHOT_VIEWS) {
    for (const theme of SCREENSHOT_THEMES) {
      for (const width of SCREENSHOT_WIDTHS) names.push(`${view}-${theme}-${width}.png`);
    }
  }
  return names;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, i) => bytes[i] === value);
}

/** The width in the IHDR chunk, or null when the file is too short or its first chunk is not IHDR. */
function ihdrWidth(bytes: Uint8Array): number | null {
  if (bytes.length < WIDTH_END) return null;
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (type !== 'IHDR') return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
}

/** One text for each missing file, extra file, file that is not a PNG, and file whose width differs from its name. `setName` finishes the text of an extra file. */
function problemsOf(expected: readonly string[], files: ReadonlyMap<string, Uint8Array>, setName: string): string[] {
  const problems: string[] = [];
  for (const name of expected) {
    const bytes = files.get(name);
    if (bytes === undefined) {
      problems.push(`${name} is missing`);
      continue;
    }
    if (!hasPngSignature(bytes)) {
      problems.push(`${name} is not a PNG file`);
      continue;
    }
    const wanted = Number(/-(\d+)\.png$/.exec(name)![1]);
    const width = ihdrWidth(bytes);
    if (width === null) problems.push(`${name} has no readable IHDR chunk`);
    else if (width !== wanted) problems.push(`${name} is ${width} pixels wide, expected ${wanted}`);
  }
  const known = new Set(expected);
  for (const name of files.keys()) {
    if (!known.has(name)) problems.push(`${name} is not one of the ${setName}`);
  }
  return problems;
}

/** One text for each missing file, extra file, file that is not a PNG, and file whose width differs from its name. */
export function setProblems(files: ReadonlyMap<string, Uint8Array>): string[] {
  return problemsOf(screenshotNames(), files, '24 screenshot names');
}

// ---------------------------------------------------------------- the full-page Landing set (second design pass, run 1)

/** The one view of the second set: the whole Landing page, top to bottom. */
export const LANDING_FULL_VIEW = 'landing-full';
/** The widths of the second set: a phone and a desktop window. */
export const LANDING_FULL_WIDTHS = [390, 1280] as const;
/** The folder under media/design/ that holds the second set; the first two sets keep `before` and `after`. */
export const LANDING_FULL_FOLDER = 'after-run1';

/** The 4 names `landing-full-<theme>-<width>.png`, in theme, then width order. */
export function landingFullNames(): string[] {
  const names: string[] = [];
  for (const theme of SCREENSHOT_THEMES) {
    for (const width of LANDING_FULL_WIDTHS) names.push(`${LANDING_FULL_VIEW}-${theme}-${width}.png`);
  }
  return names;
}

/** The same checks as `setProblems`, on the 4 files of the full-page Landing set: exactly these names, each a PNG as wide as its name says. */
export function landingFullProblems(files: ReadonlyMap<string, Uint8Array>): string[] {
  return problemsOf(landingFullNames(), files, '4 landing-full screenshot names');
}

// ---------------------------------------------------------------- the run 2 set (second design pass, run 2)

/** The folder under media/design/ that holds the run 2 captures, part by part. */
export const RUN2_FOLDER = 'after-run2';

/** One run 2 view: its name, and the widths it is captured at. A view is captured in both themes. */
export type Run2View = { name: string; widths: readonly number[] };

/** The header: closed in English and Hindi at five widths; the menu sheet open at the three widths under 1024 px. */
export const RUN2_VIEWS: readonly Run2View[] = [
  { name: 'header-closed', widths: [1280, 1024, 768, 390, 320] },
  { name: 'header-closed-hi', widths: [1280, 1024, 768, 390, 320] },
  { name: 'header-menu', widths: [768, 390, 320] },
  { name: 'header-menu-hi', widths: [768, 390, 320] },
];

/** The names `<view>-<theme>-<width>.png` of the given run 2 views (all of them when none is given), in view, theme, width order. */
export function run2Names(views: readonly string[] = RUN2_VIEWS.map((view) => view.name)): string[] {
  const names: string[] = [];
  for (const view of RUN2_VIEWS) {
    if (!views.includes(view.name)) continue;
    for (const theme of SCREENSHOT_THEMES) {
      for (const width of view.widths) names.push(`${view.name}-${theme}-${width}.png`);
    }
  }
  return names;
}

/**
 * The same checks as `setProblems` on the run 2 folder. Only the named views are expected (all when none is given); a file of
 * another run 2 view is not a problem, because the folder fills part by part; a file that is none of them is.
 */
export function run2Problems(files: ReadonlyMap<string, Uint8Array>, views?: readonly string[]): string[] {
  const wanted = new Set(run2Names(views));
  const known = new Set(run2Names());
  const problems = problemsOf(run2Names(views), files, 'run 2 screenshot names');
  return problems.filter((problem) => {
    const name = problem.split(' ')[0]!;
    return wanted.has(name) || !known.has(name);
  });
}
