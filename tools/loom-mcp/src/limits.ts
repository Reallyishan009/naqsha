/** Every size the server accepts. Each is checked before the input is parsed, decoded, rendered or written. */
export const LIMITS = {
  /** An inline JSON argument, serialised. */
  inlineJsonBytes: 1_048_576,
  /** A JSON file read from the repository. */
  jsonFileBytes: 2_097_152,
  /** A PNG file read from the repository. */
  pngFileBytes: 8_388_608,
  /** Width times height of a PNG that is decoded (4096 x 4096). */
  pngPixels: 16_777_216,
  /** Picks in one pattern. */
  picks: 5_000,
  /** Width or height of a rendered cloth, in pixels (the simulator's own limit). */
  imageSidePx: 4096,
  /** Longest export file name, with its .bmp ending. */
  fileNameChars: 64,
  /** Longest path argument. */
  pathChars: 4096,
} as const;
