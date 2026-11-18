import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PixelData } from '../../../reader/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { markerLabel, nextMarkerIndex } from '../../state/scan.ts';
import type { HookMarker, HookPosition } from '../../types.ts';
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
        {markers.map((marker, index) => (
          <button
            key={`${marker.hookRow}-${marker.hookColumn}`}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
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
          </button>
        ))}
      </div>
    </div>
  );
}
