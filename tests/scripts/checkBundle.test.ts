import { describe, expect, it } from 'vitest';
import { ENTRY_CHUNK_LIMIT_BYTES, LANDING_ENTRY_LIMIT_BYTES, formatChunkLine, landingEntryProblem } from '../../scripts/check_bundle.ts';

describe('check_bundle chunk lines', () => {
  it('R15.1 a chunk line names the file and its gzipped size in bytes', () => {
    expect(formatChunkLine('index-AbC123.js', 61234)).toBe('chunk: assets/index-AbC123.js, 61234 bytes gzipped');
    expect(formatChunkLine('Scan-x9.js', 0)).toBe('chunk: assets/Scan-x9.js, 0 bytes gzipped');
  });

  it('R15.5 the Entry_Chunk limit stays 204,800 bytes', () => {
    expect(ENTRY_CHUNK_LIMIT_BYTES).toBe(204800);
  });
  it('the Landing limit is 150,000 bytes, below the Entry_Chunk limit, which it does not replace', () => {
    expect(LANDING_ENTRY_LIMIT_BYTES).toBe(150000);
    expect(LANDING_ENTRY_LIMIT_BYTES).toBeLessThan(ENTRY_CHUNK_LIMIT_BYTES);
  });
  it('an entry chunk of 149,999 bytes passes the Landing limit and one of 150,000 bytes fails it, by name', () => {
    expect(landingEntryProblem('./assets/index-x.js', 149999)).toBeNull();
    expect(landingEntryProblem('./assets/index-x.js', 150000)).toContain('the Landing limit is 150000');
    expect(landingEntryProblem('./assets/index-x.js', ENTRY_CHUNK_LIMIT_BYTES - 1)).toContain('./assets/index-x.js');
  });
});
