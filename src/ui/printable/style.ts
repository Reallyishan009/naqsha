/** Stock colour: the Day loom --card token. */
export const STOCK_RGB: readonly [number, number, number] = [0xd8, 0xb6, 0x7a];
/** Hole ink: the Day loom --hole token. */
export const HOLE_RGB: readonly [number, number, number] = [0x1b, 0x14, 0x0c];
/** Mid-grey of the unpunched ring, lighter than the dark threshold of the reader. */
export const RING_RGB: readonly [number, number, number] = [0x96, 0x96, 0x96];
/** Ring thickness as a fraction of the hook mark diameter. The inside of the ring stays stock. */
export const RING_THICKNESS_FRACTION = 0.1;

export function rgbHex(rgb: readonly [number, number, number]): string {
  return '#' + rgb.map((value) => value.toString(16).padStart(2, '0')).join('');
}
