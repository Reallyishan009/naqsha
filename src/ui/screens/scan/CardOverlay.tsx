import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PixelData } from '../../../reader/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { markerLabel, nextMarkerIndex } from '../../state/scan.ts';
import type { HookMarker, HookPosition } from '../../types.ts';
import { Button } from '../../components/Button.tsx';
import styles from './ScanScreen.module.css';

export type CardOverlayProps = {
  image: PixelData;
  markers: ReadonlyArray<HookMarker>;
  hookRows: number;
  hookColumns: number;
  zoom: number;
  /** Side in CSS pixels of each marker's hit area (at least 48 once the zoom is at its minimum). */
  hitPx: number;
  onToggle: (position: HookPosition) => void;
  t: Translate;
};

const readNumbers = new WeakMap<PixelData, number>();
let readCount = 0;
/** A number for each photo read: the sweep is keyed by it, so it plays once per read and not again when a hook is corrected. */
export function readNumberOf(image: PixelData): number {
  let number = readNumbers.get(image);
  if (number === undefined) {
    readCount += 1;
    number = readCount;
    readNumbers.set(image, number);
  }
  return number;
}

/** Draws the photo once into a canvas. Browser only; server rendering skips the effect. */
function PhotoCanvas({ image, label }: { image: PixelData; label: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (context === null || context === undefined) return;
    const copy = new Uint8ClampedArray(image.data);
    context.putImageData(new ImageData(copy, image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} width={image.width} height={image.height} role="img" aria-label={label} className={styles.photo} />;
}

/**
 * The photo with one button per hook position (R8.3, R10.1). Markers are real buttons: a tap or Enter or Space changes
 * the hook, arrow keys move between markers, and only one marker is in the tab order (R10.8).
 */
export function CardOverlay({ image, markers, hookRows, hookColumns, zoom, hitPx, onToggle, t }: CardOverlayProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const next = nextMarkerIndex(event.key, index, hookRows, hookColumns);
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };
  return (
    <div className={styles.viewport}>
      <div className={styles.stage} style={{ width: `${zoom * 100}%` }}>
        <PhotoCanvas image={image} label={t('scan.image.alt')} />
        {/* One highlight sweep across the card when its punched holes have been found; decorative, and not drawn under reduced motion. */}
        <span key={readNumberOf(image)} aria-hidden="true" data-sweep className={styles.sweep} />
        {markers.map((marker, index) => (
          <Button
            key={`${marker.hookRow}-${marker.hookColumn}`}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            variant="quiet"
            className={styles.marker}
            data-shape={marker.shape}
            data-corrected={marker.corrected ? 'true' : 'false'}
            aria-label={markerLabel(t, marker)}
            aria-pressed={marker.shape === 'filled'}
            tabIndex={index === focusIndex ? 0 : -1}
            style={{
              left: `${(marker.centrePx.x / image.width) * 100}%`,
              top: `${(marker.centrePx.y / image.height) * 100}%`,
              width: `${hitPx}px`,
              height: `${hitPx}px`,
            }}
            onFocus={() => setFocusIndex(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onToggle({ hookRow: marker.hookRow, hookColumn: marker.hookColumn })}
          >
            <span aria-hidden="true" className={styles.shape} />
            {marker.corrected ? <span aria-hidden="true" className={styles.badge} /> : null}
          </Button>
        ))}
      </div>
    </div>
  );
}
