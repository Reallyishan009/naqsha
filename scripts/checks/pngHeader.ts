/** Direct parse of a PNG's chunks (size and `pHYs` density), written without the printable-card code. Pure. */
import { crc32 } from 'node:zlib';

export type PngInfo = {
  width: number;
  height: number;
  bitDepth: number;
  colourType: number;
  /** From the pHYs chunk; null when the file has none. */
  density: { xPixelsPerMetre: number; yPixelsPerMetre: number; unit: number } | null;
  pHYsCount: number;
  /** True when every chunk's CRC matches its bytes. */
  crcsValid: boolean;
};

export type PngInfoResult = { ok: true; info: PngInfo } | { ok: false; reason: string };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function parsePngInfo(bytes: Uint8Array): PngInfoResult {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((value, i) => bytes[i] !== value)) {
    return { ok: false, reason: 'no PNG signature' };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = SIGNATURE.length;
  let ihdr: { width: number; height: number; bitDepth: number; colourType: number } | null = null;
  let density: PngInfo['density'] = null;
  let pHYsCount = 0;
  let crcsValid = true;
  let first = true;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return { ok: false, reason: 'truncated chunk header' };
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return { ok: false, reason: 'chunk runs past the end of the file' };
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    if (first && type !== 'IHDR') return { ok: false, reason: `first chunk is ${type}, not IHDR` };
    first = false;
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) crcsValid = false;
    const data = offset + 8;
    if (type === 'IHDR' && length === 13) {
      ihdr = {
        width: view.getUint32(data),
        height: view.getUint32(data + 4),
        bitDepth: bytes[data + 8]!,
        colourType: bytes[data + 9]!,
      };
    } else if (type === 'pHYs' && length === 9) {
      pHYsCount++;
      density = { xPixelsPerMetre: view.getUint32(data), yPixelsPerMetre: view.getUint32(data + 4), unit: bytes[data + 8]! };
    }
    offset = end;
  }
  if (ihdr === null) return { ok: false, reason: 'no IHDR chunk' };
  return { ok: true, info: { ...ihdr, density, pHYsCount, crcsValid } };
}
