/** Pure parts of the screenshot command: the 24 file names and the checks on a saved set. No I/O. */

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

/** One text for each missing file, extra file, file that is not a PNG, and file whose width differs from its name. */
export function setProblems(files: ReadonlyMap<string, Uint8Array>): string[] {
  const problems: string[] = [];
  const expected = screenshotNames();
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
    if (!known.has(name)) problems.push(`${name} is not one of the 24 screenshot names`);
  }
  return problems;
}
