import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/source.ts';

const ARCHIVE = path.resolve(import.meta.dirname, '../../src/archive');
const files = readdirSync(ARCHIVE)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, code: stripComments(readFileSync(path.join(ARCHIVE, name), 'utf8'), false) }));

describe('src/archive structure', () => {
  it('R6.11 only idbStore.ts mentions indexedDB', () => {
    const mentioning = files.filter((file) => /\bindexedDB\b/.test(file.code)).map((file) => file.name);
    expect(mentioning).toEqual(['idbStore.ts']);
  });

  it('R6.11 no file in src/archive mentions localStorage', () => {
    expect(files.filter((file) => /localStorage/.test(file.code)).map((file) => file.name)).toEqual([]);
  });

  it('R6.11 imports from src/codec are type-only and go through index.ts', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const match of file.code.matchAll(/^\s*import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gms)) {
        const [, clause = '', source = ''] = match;
        if (!source.includes('codec')) continue;
        if (source !== '../codec/index.ts' || !clause.startsWith('type ')) offenders.push(`${file.name}: ${match[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
