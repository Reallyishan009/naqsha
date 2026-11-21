import { useLayoutEffect, useRef, useState } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { paintToCanvas, parseRenderSettings, prepareCloth, renderFrame } from '../../../simulator/index.ts';
import type { SimImage } from '../../../simulator/index.ts';
import { DEFAULT_CLOTH_CHOICES } from '../../state/appState.ts';
import { viewportFor, weftPlan } from '../../state/cloth.ts';
import styles from './Landing.module.css';

/** Thread size of the preview, in pixels: the smallest the simulator accepts, so a whole design fits in a small picture. */
const PREVIEW_THREAD_SIZE_PX = 3;
/** Picks of warp shown below the woven cloth, as the simulator draws it (the shed at the fell). */
const SHED_PICKS = 6;

/**
 * The finished cloth of a design as one small picture: the simulator's frame after the last pick, one thread
 * size to an end and to a pick. It makes no request and never throws; any failure comes back as `null`.
 */
export function renderClothPreview(profile: CardProfile, pattern: Pattern): SimImage | null {
  try {
    const prepared = prepareCloth(profile, pattern);
    if (!prepared.ok) return null;
    const cloth = prepared.value;
    const viewport = viewportFor(
      cloth.baseEnds * PREVIEW_THREAD_SIZE_PX,
      (cloth.picks.length + SHED_PICKS) * PREVIEW_THREAD_SIZE_PX,
    );
    const settings = parseRenderSettings({
      warpColour: DEFAULT_CLOTH_CHOICES.warpColour,
      weftPlan: weftPlan(DEFAULT_CLOTH_CHOICES),
      threadSizePx: PREVIEW_THREAD_SIZE_PX,
      repeat: 1,
      viewport,
      floatHighlight: null,
    });
    if (!settings.ok) return null;
    const frame = renderFrame(cloth, settings.value, { pick: cloth.picks.length, phase: 'rest' });
    return frame.ok ? frame.value : null;
  } catch {
    return null;
  }
}

export type ClothPreviewProps = {
  profile: CardProfile;
  pattern: Pattern;
};

/**
 * A small picture of the cloth a Sample_Design weaves, drawn by the simulator from the design's own Pattern. It is
 * decoration beside the design's name, so it is hidden from assistive technology. When it cannot be drawn it shows
 * nothing, and the tile around it keeps its name and its label.
 */
export function ClothPreview({ profile, pattern }: ClothPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  // Before the first paint, so the tile never shows an empty canvas and then jumps to the picture's size.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    try {
      const image = renderClothPreview(profile, pattern);
      const context = image === null ? null : canvas.getContext('2d');
      if (image === null || context === null) {
        setFailed(true);
        return;
      }
      canvas.width = image.width;
      canvas.height = image.height;
      paintToCanvas(context)(image);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [profile, pattern]);
  if (failed) return null;
  return <canvas ref={canvasRef} className={styles.preview} aria-hidden="true" />;
}
