/**
 * Dev-only photo trial page (task 7.1). Not part of the app build.
 * Loads a photo through loadPixelData, runs readCard with the demo profile and reports the result,
 * the accuracy against the rendered card's ground truth, and diagnostics from the public reader functions.
 */
import { parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../src/codec/index.ts';
import {
  MAX_CANDIDATE_REGIONS,
  MIN_REGION_AREA_PX,
  cardToImage,
  chooseThreshold,
  classifyDark,
  equivalentDiameterPx,
  findDarkRegions,
  loadPixelData,
  orientationSeparation,
  rankPegHolePairs,
  readCard,
  selectPegHolePair,
  toGreyscale,
} from '../src/reader/index.ts';
import type { DarkRegion, PegHolePair, PixelData, Pose, ReadResult } from '../src/reader/index.ts';

type Truth = { card: CardGrid; options: { pixelsPerMm: number; tiltDegrees: number; seed: number } };

const PROFILE_URL = '/profiles/demo-12x16.json';
const TRUTH_URL = new URL('./photo-trial/card.json', import.meta.url).href;
const PREVIEW_MAX_PX = 960;

const fileInput = document.getElementById('photo') as HTMLInputElement;
const canvas = document.getElementById('preview') as HTMLCanvasElement;
const reportEl = document.getElementById('report') as HTMLPreElement;
const copyButton = document.getElementById('copy') as HTMLButtonElement;
const copyStatus = document.getElementById('copyStatus') as HTMLSpanElement;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function fixed(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function failureLines(result: Extract<ReadResult, { ok: false }>): string[] {
  const f = result.failure;
  const lines = [`RESULT: FAILED, reason ${f.reason}`];
  switch (f.reason) {
    case 'invalid-profile':
      for (const v of f.violations) lines.push(`  violation ${v.kind} at ${v.location}: ${v.message}`);
      break;
    case 'invalid-image':
      lines.push(`  detail: ${f.detail}`);
      break;
    case 'ambiguous-orientation':
      lines.push(`  separation: ${f.separation}`);
      break;
    case 'resolution-too-low':
      lines.push(`  holeDiameterPx: ${f.holeDiameterPx}`, `  minimumPx: ${f.minimumPx}`);
      break;
    default:
      break;
  }
  return lines;
}

type Overlay = { pose: Pose | null; readGrid: CardGrid | null; mismatches: Set<string>; pegCentres: { x: number; y: number }[] };

function drawPreview(pixels: PixelData, profile: CardProfile, overlay: Overlay): void {
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(pixels.width, pixels.height));
  canvas.width = Math.max(1, Math.round(pixels.width * scale));
  canvas.height = Math.max(1, Math.round(pixels.height * scale));
  const full = document.createElement('canvas');
  full.width = pixels.width;
  full.height = pixels.height;
  const fullContext = full.getContext('2d');
  const context = canvas.getContext('2d');
  if (fullContext === null || context === null) return;
  fullContext.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  context.drawImage(full, 0, 0, canvas.width, canvas.height);
  const { pose, readGrid } = overlay;
  const radius = Math.max(2, (profile.holeDiameterMm / 2) * (pose?.pixelsPerMm ?? 1) * scale);
  if (pose !== null && readGrid !== null) {
    context.lineWidth = 2;
    for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
      for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
        const centre = cardToImage(pose, {
          x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
          y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
        });
        const x = centre.x * scale;
        const y = centre.y * scale;
        const punched = readGrid[hookRow]?.[hookColumn] === true;
        context.fillStyle = punched ? 'rgba(0,200,0,0.7)' : 'rgba(150,150,150,0.7)';
        context.beginPath();
        context.arc(x, y, radius * 0.6, 0, 2 * Math.PI);
        context.fill();
        if (overlay.mismatches.has(`${hookRow},${hookColumn}`)) {
          context.strokeStyle = '#e00';
          context.beginPath();
          context.arc(x, y, radius * 1.3, 0, 2 * Math.PI);
          context.stroke();
        }
      }
    }
  }
  context.strokeStyle = '#06f';
  context.lineWidth = 2;
  for (const centre of overlay.pegCentres) {
    context.beginPath();
    context.arc(centre.x * scale, centre.y * scale, Math.max(4, radius * 1.5), 0, 2 * Math.PI);
    context.stroke();
  }
}

async function run(file: File): Promise<void> {
  reportEl.textContent = 'Working...';
  copyButton.disabled = true;
  const lines: string[] = [`file: ${file.name} (${file.type}, ${file.size} bytes)`];
  try {
    const parsed = parseCardProfile(await fetchJson(PROFILE_URL));
    if (!parsed.ok) throw new Error(`profile invalid: ${parsed.violations.map((v) => v.kind).join(', ')}`);
    const profile = parsed.value;
    const truth = (await fetchJson(TRUTH_URL)) as Truth;

    // An HTMLImageElement makes the browser apply the photo's EXIF rotation.
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();
    const pixels = await loadPixelData(img);
    URL.revokeObjectURL(url);
    lines.push(`image size: ${pixels.width} x ${pixels.height} px`);

    const started = performance.now();
    const result = readCard(profile, pixels);
    lines.push(`read time: ${fixed(performance.now() - started, 1)} ms`);

    // Diagnostics recomputed with the public reader functions (as tests/reader/accuracy.test.ts does).
    const grey = toGreyscale(pixels);
    const threshold = chooseThreshold(grey);
    const map = classifyDark(grey, threshold);
    const candidates: DarkRegion[] = findDarkRegions(map)
      .map((region, scanIndex) => ({ region, scanIndex }))
      .filter(({ region }) => !region.touchesEdge && region.area >= MIN_REGION_AREA_PX)
      .sort((a, b) => b.region.area - a.region.area || a.scanIndex - b.scanIndex)
      .slice(0, MAX_CANDIDATE_REGIONS)
      .map(({ region }) => region);
    const selection = selectPegHolePair(profile, candidates, { width: pixels.width, height: pixels.height });

    const overlay: Overlay = { pose: null, readGrid: null, mismatches: new Set(), pegCentres: [] };
    if (result.ok) {
      const { pose } = result;
      lines.push('RESULT: OK');
      lines.push(
        `pose: tilt ${fixed(pose.tiltDegrees)} deg, scale ${fixed(pose.pixelsPerMm, 3)} px/mm ` +
          `(render was ${truth.options.pixelsPerMm} px/mm), ` +
          `orientation ${pose.orientation}, origin (${fixed(pose.originPx.x, 1)}, ${fixed(pose.originPx.y, 1)}) px`,
      );
      const total = profile.hookRows * profile.hookColumns;
      const mismatched: string[] = [];
      for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
        for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
          if (result.grid[hookRow]?.[hookColumn] !== truth.card[hookRow]?.[hookColumn]) {
            mismatched.push(`(${hookRow}, ${hookColumn})`);
            overlay.mismatches.add(`${hookRow},${hookColumn}`);
          }
        }
      }
      const matched = total - mismatched.length;
      lines.push(`accuracy: ${fixed((matched / total) * 100)}% (${matched}/${total})`);
      lines.push(`mismatched (hookRow, hookColumn): [${mismatched.join(' ')}]`);
      overlay.pose = pose;
      overlay.readGrid = result.grid;
    } else {
      lines.push(...failureLines(result));
    }

    lines.push('diagnostics:');
    lines.push(`  threshold: ${threshold}`);
    lines.push(`  candidate regions: ${candidates.length}`);
    let pair: PegHolePair | null = null;
    let pose: Pose | null = null;
    if (selection.kind === 'selected') {
      pair = selection.pair;
      pose = selection.pose;
      const l = selection.layout;
      lines.push(
        `  selected pair, layout: matches ${l.matches}, inCard ${l.inCard}, explained ${l.explained}, ` +
          `missingLacingHoles ${l.missingLacingHoles}`,
      );
    } else if (selection.kind === 'ambiguous') {
      lines.push(`  selection: ambiguous, separation ${selection.separation}`);
    } else {
      lines.push('  selection: none (no peg hole pair matched the layout)');
    }
    if (pair === null) {
      pair = rankPegHolePairs(profile, candidates, 1)[0] ?? null;
      if (pair !== null) lines.push('  (best-ranked pair by diameter fit, not layout-verified)');
    }
    if (pair !== null) {
      const [peg0, peg1] = profile.pegHoles;
      const expected: [number, number] = [peg0.diameterMm * pair.pixelsPerMm, peg1.diameterMm * pair.pixelsPerMm];
      const measured: [number, number] = [
        equivalentDiameterPx(pair.uprightRegions[0]),
        equivalentDiameterPx(pair.uprightRegions[1]),
      ];
      const q = orientationSeparation(expected, measured);
      lines.push(
        `  peg diameters (role 0, role 1), measured ${fixed(measured[0], 1)} / ${fixed(measured[1], 1)} px, ` +
          `expected ${fixed(expected[0], 1)} / ${fixed(expected[1], 1)} px, ` +
          `pair scale ${fixed(pair.pixelsPerMm, 3)} px/mm, fit ${fixed(pair.fit, 3)}, separation q ${fixed(q, 2)}`,
      );
      overlay.pegCentres = pair.uprightRegions.map((r) => r.centroid);
    }
    if (pose !== null && overlay.pose === null) {
      lines.push(
        `  chosen pose: tilt ${fixed(pose.tiltDegrees)} deg, scale ${fixed(pose.pixelsPerMm, 3)} px/mm, ${pose.orientation}`,
      );
    }
    drawPreview(pixels, profile, overlay);
    copyButton.disabled = false;
  } catch (error) {
    lines.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }
  reportEl.textContent = lines.join('\n');
  copyButton.disabled = false;
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void run(file);
});

copyButton.addEventListener('click', async () => {
  const text = reportEl.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Copied.';
  } catch {
    // navigator.clipboard needs a secure context; over plain http from a phone, fall back to execCommand.
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    copyStatus.textContent = ok ? 'Copied.' : 'Copy failed: select the report text and copy it by hand.';
  }
});
