import { describe, expect, it } from 'vitest';

import { SAMPLE_BMP_PICK_COUNT, exportSampleDesigns } from '../../scripts/export_sample.ts';

function header(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    magic: String.fromCharCode(bytes[0]!, bytes[1]!),
    fileSize: view.getUint32(2, true),
    width: view.getInt32(18, true),
    height: view.getInt32(22, true),
    bitDepth: view.getUint16(28, true),
  };
}

describe('sample design BMPs', () => {
  it('R7.4 exporting the sample designs twice gives identical bytes', () => {
    const first = exportSampleDesigns();
    const second = exportSampleDesigns();
    expect(Buffer.from(first.oneBit).equals(Buffer.from(second.oneBit))).toBe(true);
    expect(Buffer.from(first.eightBit).equals(Buffer.from(second.eightBit))).toBe(true);
  });

  it('R3.6 each sample file starts with BM, has the size its header states, and is 192 ends by 200 picks', () => {
    const { oneBit, eightBit } = exportSampleDesigns();
    for (const [bytes, bitDepth] of [[oneBit, 1], [eightBit, 8]] as const) {
      const fields = header(bytes);
      expect(fields.magic).toBe('BM');
      expect(fields.fileSize).toBe(bytes.length);
      expect(fields.width).toBe(192);
      expect(fields.height).toBe(SAMPLE_BMP_PICK_COUNT);
      expect(fields.bitDepth).toBe(bitDepth);
    }
  });
});
