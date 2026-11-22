import { parseRenderSettings, renderFrame } from '../../simulator/index.ts';
import type { Frame, RenderSettings } from '../../simulator/index.ts';
import { HOOK_UNITS, LIFT_UNITS, PRESS_UNITS } from './heroLayout.ts';
import { CARD_GAP_UNITS, CLOTH_STRETCH, WARP_BAND_UNITS, liftLevel } from './processScene.ts';
import type { ProcessPose, ProcessScene } from './processScene.ts';

/*
 * The drawing of the Process_Loop on a 2D canvas. It is the only file of the Process_Loop that touches browser
 * drawing APIs. Every colour is read from the design tokens of the page, so day and night both work.
 */

/** The tokens the picture uses, as CSS colour strings. */
export type ProcessColours = {
  surface: string;
  line: string;
  inkSoft: string;
  card: string;
  punchedHole: string;
  zari: string;
  indigo: string;
};

const TOKENS: Record<keyof ProcessColours, string> = {
  surface: '--surface',
  line: '--line',
  inkSoft: '--ink-soft',
  card: '--card',
  punchedHole: '--hole',
  zari: '--zari',
  indigo: '--indigo',
};

/** The colours of the element's tokens now. An empty token stays an empty string and draws nothing visible. */
export function readColours(element: Element): ProcessColours {
  const style = getComputedStyle(element);
  const read = (token: string): string => style.getPropertyValue(token).trim();
  const colours = {} as ProcessColours;
  for (const key of Object.keys(TOKENS) as Array<keyof ProcessColours>) colours[key] = read(TOKENS[key]);
  return colours;
}

/** A key that changes when any colour changes, so cached pictures are made again. */
export const coloursKey = (colours: ProcessColours): string => Object.values(colours).join('|');

/**
 * The render settings of the cloth image: the warp in `--indigo`, a plain weft in `--card`, one repeat, no float
 * highlight, a viewport as large as the image. `null` when a colour is not '#rrggbb'.
 */
export function clothSettings(scene: ProcessScene, colours: ProcessColours): RenderSettings | null {
  const parsed = parseRenderSettings({
    warpColour: colours.indigo,
    weftPlan: [{ kind: 'plain', colour: colours.card }],
    threadSizePx: scene.image.threadSizePx,
    repeat: 1,
    viewport: { width: scene.image.width, height: scene.image.height },
    floatHighlight: null,
  });
  return parsed.ok ? parsed.value : null;
}

export type Painter = {
  /** Draws one pose. */
  paint(pose: ProcessPose): void;
  /** Reads the tokens again; the next paint uses them. */
  refresh(): void;
};

/** What the painter needs from the page, injectable so a test can run without a DOM. */
export type PainterDeps = {
  canvas: HTMLCanvasElement;
  /** A canvas of the cloth image's size to put the simulator's pixels on. */
  makeLayer: (width: number, height: number) => HTMLCanvasElement | null;
  makeImageData: (data: Uint8ClampedArray, width: number, height: number) => ImageData;
  colours: (element: Element) => ProcessColours;
};

const frameKey = (frame: Frame): string => (frame.phase === 'pass' ? `${frame.pick}:pass:${frame.step}` : `${frame.pick}:${frame.phase}`);

/**
 * The painter of a scene on a canvas. The canvas is `scene.units` drawing units large at `canvas.width / units.width`
 * pixels to the unit. The cloth image comes from renderFrame, one call for each new frame, and is cached while the
 * frame stays the same.
 */
export function createPainter(scene: ProcessScene, deps: PainterDeps): Painter | null {
  const { canvas } = deps;
  const context = canvas.getContext('2d');
  const layer = deps.makeLayer(scene.image.width, scene.image.height);
  const layerContext = layer === null ? null : layer.getContext('2d');
  if (context === null || layer === null || layerContext === null) return null;

  let colours = deps.colours(canvas);
  let settings = clothSettings(scene, colours);
  let layerKey = '';

  const { layout, geometry } = scene;
  const { card, needles, hooks, warp, head } = layout;
  const cardScale = card.width / geometry.widthMm;
  const fellY = warp.y + WARP_BAND_UNITS;
  const clothScaleX = card.width / scene.image.width;
  const clothScaleY = clothScaleX * CLOTH_STRETCH;

  /** Puts the simulator's frame on the layer, unless it is there already. */
  function updateLayer(frame: Frame): boolean {
    if (settings === null || layerContext === null) return false;
    const key = `${coloursKey(colours)}#${frameKey(frame)}`;
    if (key === layerKey) return true;
    const image = renderFrame(scene.cloth, settings, frame);
    if (!image.ok) return false;
    layerContext.putImageData(deps.makeImageData(image.value.data, image.value.width, image.value.height), 0, 0);
    layerKey = key;
    return true;
  }

  function drawCard(c: CanvasRenderingContext2D, pick: number, x: number, y: number, lit: number): void {
    c.fillStyle = colours.card;
    c.strokeStyle = colours.inkSoft;
    c.lineWidth = 1.5;
    c.beginPath();
    c.rect(x, y, card.width, card.height);
    c.fill();
    c.stroke();

    const at = (mmX: number, mmY: number): [number, number] => [x + mmX * cardScale, y + mmY * cardScale];
    const disc = (mmX: number, mmY: number, diameterMm: number): void => {
      const [cx, cy] = at(mmX, mmY);
      c.moveTo(cx + (diameterMm / 2) * cardScale, cy);
      c.arc(cx, cy, (diameterMm / 2) * cardScale, 0, Math.PI * 2);
    };

    c.fillStyle = colours.punchedHole;
    c.beginPath();
    for (const peg of geometry.pegHoles) disc(peg.centreMm.x, peg.centreMm.y, peg.diameterMm);
    for (const lacing of geometry.lacingHoles) disc(lacing.centreMm.x, lacing.centreMm.y, lacing.diameterMm);
    const punched = scene.punched[pick] ?? [];
    for (const position of punched) disc(position.centreMm.x, position.centreMm.y, geometry.holeDiameterMm);
    c.fill();

    if (lit > 0.01 && punched.length > 0) {
      // A lit punched hole shows the lamp behind the card: a zari disc inside it, and a ring round it.
      c.globalAlpha = lit;
      c.fillStyle = colours.zari;
      c.strokeStyle = colours.zari;
      c.lineWidth = 2;
      c.beginPath();
      for (const position of punched) {
        const [cx, cy] = at(position.centreMm.x, position.centreMm.y);
        const radius = (geometry.holeDiameterMm / 2) * cardScale;
        c.moveTo(cx + radius * 0.5, cy);
        c.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      }
      c.fill();
      c.beginPath();
      for (const position of punched) {
        const [cx, cy] = at(position.centreMm.x, position.centreMm.y);
        const radius = (geometry.holeDiameterMm / 2) * cardScale;
        c.moveTo(cx + radius * 1.3, cy);
        c.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      }
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  function paint(pose: ProcessPose): void {
    if (context === null || layer === null) return;
    const c = context;
    const k = canvas.width / scene.units.width;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, scene.units.width, scene.units.height);
    c.fillStyle = colours.surface;
    c.fillRect(0, 0, scene.units.width, scene.units.height);

    // The Jacquard head.
    c.strokeStyle = colours.inkSoft;
    c.fillStyle = colours.surface;
    c.lineWidth = 1.5;
    c.beginPath();
    c.rect(head.x, head.y, head.width, head.height);
    c.fill();
    c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(head.x, head.y + head.height / 2);
    c.lineTo(head.x + head.width, head.y + head.height / 2);
    c.stroke();

    // The chain of cards: the card at the head and the one next to it, each lit by how near the head it is.
    const first = Math.max(0, Math.floor(pose.pos));
    const lastShown = Math.min(scene.count - 1, Math.floor(pose.pos) + 1);
    const press = PRESS_UNITS * pose.press;
    for (let pick = first; pick <= lastShown; pick++) {
      const offset = (pick - pose.pos) * (card.width + CARD_GAP_UNITS);
      const near = Math.max(0, 1 - Math.abs(pick - pose.pos));
      c.save();
      c.beginPath();
      c.rect(0, 0, scene.units.width, scene.units.height);
      c.clip();
      drawCard(c, pick, card.x + offset, card.y + press, near * near * (3 - 2 * near));
      c.restore();
    }

    // The needles under the card.
    c.strokeStyle = colours.inkSoft;
    c.lineWidth = 1;
    c.beginPath();
    for (const x of layout.endX) {
      c.moveTo(x, needles.y);
      c.lineTo(x, needles.y + needles.height);
    }
    c.stroke();

    // Hooks and warp ends: lifted ones are higher and zari, the rest sit at rest in indigo.
    const hookRestTop = hooks.y + LIFT_UNITS;
    const hookBottom = hooks.y + HOOK_UNITS;
    const warpBottom = warp.y + WARP_BAND_UNITS;
    c.lineWidth = 2;
    for (const raisedPass of [false, true]) {
      c.strokeStyle = raisedPass ? colours.zari : colours.indigo;
      c.beginPath();
      layout.endX.forEach((x, end) => {
        const level = liftLevel(scene, pose, end);
        if (level >= 0.5 !== raisedPass) return;
        const rise = LIFT_UNITS * level;
        c.moveTo(x, hookRestTop - rise);
        c.lineTo(x, hookBottom - rise);
        c.moveTo(x, warp.y - rise);
        c.lineTo(x, warpBottom - rise);
      });
      c.stroke();
    }
    c.fillStyle = colours.inkSoft;
    c.fillRect(warp.x, warp.y - 2, warp.width, 4);

    // The cloth: the simulator's own image, drawn upside down so the fell is at the top and the cloth grows downward.
    if (pose.clothAlpha > 0.01 && updateLayer(pose.frame)) {
      const wovenPx = scene.image.shedPx + pose.frame.pick * scene.image.threadSizePx;
      const heightPx = Math.min(scene.image.height, wovenPx);
      const top = scene.image.height - heightPx;
      c.save();
      c.globalAlpha = pose.clothAlpha;
      c.translate(card.x, fellY + clothScaleY * scene.image.height);
      c.scale(clothScaleX, -clothScaleY);
      c.drawImage(layer, 0, top, scene.image.width, heightPx, 0, top, scene.image.width, heightPx);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  return {
    paint,
    refresh() {
      colours = deps.colours(canvas);
      settings = clothSettings(scene, colours);
      layerKey = '';
    },
  };
}

/** The canvas pixels to the drawing unit: enough for a sharp picture without making the page heavy. */
export const PAINT_SCALE = 0.9;

/** The browser's way to make the painter's layer and image data. */
export function browserPainterDeps(canvas: HTMLCanvasElement): PainterDeps {
  return {
    canvas,
    makeLayer(width, height) {
      const layer = canvas.ownerDocument.createElement('canvas');
      layer.width = width;
      layer.height = height;
      return layer;
    },
    makeImageData: (data, width, height) => new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height),
    colours: readColours,
  };
}
