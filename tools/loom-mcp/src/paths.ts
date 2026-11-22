import { lstatSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS } from './limits.ts';
import { ToolError } from './result.ts';
/** Where export_bmp may write, relative to the repository root. */
export const OUT_DIRECTORY = 'tools/loom-mcp/out';
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.bmp$/;
const NOT_ALLOWED_HINT = 'Use a path inside the repository, such as tests/fixtures/pick0-clean.png.';
function notAllowed(message: string, hint = NOT_ALLOWED_HINT): ToolError {
  return new ToolError('path_not_allowed', message, hint);
}
export type PathGuard = {
  /** The real path of the repository root. */
  readonly root: string;
  /** The real path of the file to read, or a ToolError: never outside the root, never a directory. */
  readable(input: unknown): string;
  /** The target for a bare file name inside the out directory, and its path from the root. Creates the directory. */
  writable(fileName: unknown): { absolute: string; relative: string };
};
/**
 * The only door to the file system. Reads: no ".." segment, resolved from the root, and the real path (after
 * symlinks) must still be inside the root. Writes: a bare file name, written only inside the out directory, which
 * must itself be a real directory inside the root; an existing target must be a plain file, not a link.
 */
export function createPathGuard(rootPath: string): PathGuard {
  const root = realpathSync(rootPath);
  const inside = (candidate: string): boolean => {
    const relative = path.relative(root, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  return {
    root,
    readable(input: unknown): string {
      if (typeof input !== 'string' || input === '' || input.length > LIMITS.pathChars || input.includes('\0')) {
        throw notAllowed('The path is not a usable text.');
      }
      if (input.split(/[\\/]+/).includes('..')) throw notAllowed('The path contains a ".." segment.');
      const candidate = path.resolve(root, input);
      let real: string;
      try {
        real = realpathSync(candidate);
      } catch {
        // A path that is not there is refused as outside when it lies outside, so no answer tells whether it exists.
        if (!inside(candidate)) throw notAllowed('The path is outside the repository.');
        throw new ToolError('not_found', 'No file exists at that path.', 'Check the path, relative to the repository root.');
      }
      if (!inside(real)) throw notAllowed('The path is outside the repository, or leads outside it through a link.');
      if (!statSync(real).isFile()) throw notAllowed('The path is not a file.');
      return real;
    },
    writable(fileName: unknown): { absolute: string; relative: string } {
      if (typeof fileName !== 'string' || fileName.length > LIMITS.fileNameChars || !FILE_NAME.test(fileName) || fileName.includes('..')) {
        throw notAllowed(
          'The file name must be a bare name of letters, digits, dot, dash and underscore that ends in .bmp.',
          'Use a name such as design.bmp. Files are written only to tools/loom-mcp/out/.',
        );
      }
      const expected = path.join(root, ...OUT_DIRECTORY.split('/'));
      mkdirSync(expected, { recursive: true });
      if (realpathSync(expected) !== expected) throw notAllowed('The output directory is a link, so nothing is written there.');
      const absolute = path.join(expected, fileName);
      try {
        if (!lstatSync(absolute).isFile()) throw notAllowed('A link or directory already has that name in the output directory.');
      } catch (error) {
        if (error instanceof ToolError) throw error;
        // No such file yet: a new file is fine.
      }
      return { absolute, relative: path.relative(root, absolute).split(path.sep).join('/') };
    },
  };
}
/** The guard for this repository. The root comes from where this file is, never from the working directory or the environment. */
export const repoGuard: PathGuard = createPathGuard(fileURLToPath(new URL('../../../', import.meta.url)));
