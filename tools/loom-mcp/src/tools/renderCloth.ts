import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeFloats, parseRenderSettings, prepareCloth, renderFrame } from '../../../../src/simulator/index.ts';
import { resolvePattern, resolveProfile } from '../input.ts';
import { LIMITS } from '../limits.ts';
import { ToolError, guarded, succeed } from '../result.ts';
import { encodePngRgba } from '../../../../scripts/png_rgba.ts';
import { READ_ONLY, patternArguments, profileArguments } from './shared.ts';
const COLOUR = /^#[0-9a-fA-F]{6}$/;
/** The woven picks stack above a shed that is six threads tall, and the view is at least 18 threads tall. */
const SHED_THREADS = 6;
const MIN_THREADS_HIGH = 18;
function checkOption(name: string, value: number, low: number, high: number): void {
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new ToolError('invalid_option', `The option ${name} must be a whole number from ${low} to ${high}.`, `Change ${name} to a value in that range.`);
  }
}
export function registerRenderCloth(server: McpServer): void {
  server.registerTool(
    'render_cloth',
    {
      title: 'Render the woven cloth',
      description:
        'Weaves a design on screen and returns a PNG of the finished cloth with counts of picks, gaps (cards that are missing or damaged) and floats. Use it to see how a design will look before threading a loom.',
      inputSchema: {
        ...patternArguments,
        ...profileArguments,
        repeat: z.number().optional().describe('How many times the design is tiled across the cloth, 1 to 64. Default 1.'),
        threadSizePx: z.number().optional().describe('Size of one warp or weft in pixels, 3 to 16. Default 6.'),
        warpColour: z.string().optional().describe('Warp colour as #rrggbb. Default #2b3a67.'),
        weftColour: z.string().optional().describe('Weft colour as #rrggbb. Default #f1ead8.'),
      },
      outputSchema: {
        picks: z.number(),
        gapCount: z.number(),
        gaps: z.array(z.object({ pick: z.number(), kind: z.string() })),
        floatCount: z.number(),
        longestFloat: z.number(),
        width: z.number(),
        height: z.number(),
        pngBytes: z.number(),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      guarded(() => {
        const repeat = args.repeat ?? 1;
        const size = args.threadSizePx ?? 6;
        const warp = args.warpColour ?? '#2b3a67';
        const weft = args.weftColour ?? '#f1ead8';
        checkOption('repeat', repeat, 1, 64);
        checkOption('threadSizePx', size, 3, 16);
        for (const [name, value] of [['warpColour', warp], ['weftColour', weft]] as const) {
          if (!COLOUR.test(value)) throw new ToolError('invalid_option', `The option ${name} must be written as #rrggbb.`, `Use a colour such as ${name === 'warpColour' ? '#2b3a67' : '#f1ead8'}.`);
        }
        const profile = resolveProfile({ inline: args.profile, path: args.profilePath }, true);
        const pattern = resolvePattern({ inline: args.pattern, path: args.patternPath });
        const cloth = prepareCloth(profile, pattern);
        if (!cloth.ok) throw new ToolError('invalid_pattern', `The design could not be prepared (${cloth.failure.reason}).`, 'Check the card profile and the design.');
        const width = cloth.value.baseEnds * repeat * size;
        const height = Math.max(pattern.length + SHED_THREADS, MIN_THREADS_HIGH) * size;
        if (width > LIMITS.imageSidePx || height > LIMITS.imageSidePx) {
          throw new ToolError(
            'too_large',
            `The cloth would be ${width} x ${height} pixels, more than ${LIMITS.imageSidePx} on a side.`,
            'Lower repeat or threadSizePx, or use fewer picks.',
          );
        }
        const settings = parseRenderSettings({
          warpColour: warp,
          weftPlan: [{ kind: 'plain', colour: weft }],
          threadSizePx: size,
          repeat,
          viewport: { width, height },
          floatHighlight: null,
        });
        if (!settings.ok) throw new ToolError('invalid_option', `The render settings were refused (${settings.failure.reason}).`, 'Check repeat, threadSizePx and the colours.');
        const image = renderFrame(cloth.value, settings.value, { pick: pattern.length, phase: 'rest' });
        if (!image.ok) throw new ToolError('internal_error', `The cloth could not be drawn (${image.failure.reason}).`, 'Report this.');
        const png = encodePngRgba(image.value.width, image.value.height, image.value.data);
        const floats = computeFloats(cloth.value, repeat);
        const longestFloat = floats.reduce((longest, float) => Math.max(longest, float.length), 0);
        const gaps = cloth.value.gaps.map((gap) => ({ pick: gap.pick, kind: gap.kind }));
        return succeed(
          {
            picks: pattern.length,
            gapCount: gaps.length,
            gaps,
            floatCount: floats.length,
            longestFloat,
            width: image.value.width,
            height: image.value.height,
            pngBytes: png.length,
          },
          `Wove ${pattern.length} picks (${gaps.length} gap${gaps.length === 1 ? '' : 's'}, ${floats.length} float${floats.length === 1 ? '' : 's'}, longest ${longestFloat}) into a ${image.value.width} x ${image.value.height} image.`,
          [{ type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' }],
        );
      }),
  );
}
