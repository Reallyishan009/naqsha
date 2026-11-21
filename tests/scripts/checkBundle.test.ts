import { describe, expect, it } from 'vitest';
import { ENTRY_CHUNK_LIMIT_BYTES, formatChunkLine } from '../../scripts/check_bundle.ts';

describe('check_bundle chunk lines', () => {
  it('R15.1 a chunk line names the file and its gzipped size in bytes', () => {
    expect(formatChunkLine('index-AbC123.js', 61234)).toBe('chunk: assets/index-AbC123.js, 61234 bytes gzipped');
    expect(formatChunkLine('Scan-x9.js', 0)).toBe('chunk: assets/Scan-x9.js, 0 bytes gzipped');
  });

  it('R15.5 the Entry_Chunk limit stays 204,800 bytes', () => {
    expect(ENTRY_CHUNK_LIMIT_BYTES).toBe(204800);
  });
});
