/**
 * The line weights of the Step_Icons and Spot_Illustrations, in drawing units. Every stroke in those drawings takes
 * its width from here, so all six look drawn with the same pen.
 */
export const STROKE = {
  /** The outline of a thing: a card, a frame, a sheet, a shelf. */
  line: 2,
  /** A detail inside an outline: a ruled line, a weft, a mark on a card. */
  fine: 1.5,
} as const;
