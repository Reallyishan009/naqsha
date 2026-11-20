import { statSync, writeFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bmpLayout, exportPatternBmp } from '../../../../src/exporter/index.ts';
import { resolvePattern, resolveProfile } from '../input.ts';
import { repoGuard } from '../paths.ts';
import { ToolError, failure, guarded, succeed } from '../result.ts';
import { patternArguments, profileArguments } from './shared.ts';
export function registerExportBmp(server: McpServer): void {
  server.registerTool(
    'export_bmp',
    {
      title: 'Export a design as a 1-bit BMP',
      description:
        'Writes a design as a 1-bit BMP file (one pixel per end, one line per pick) that an electronic Jacquard loom can read. The file is written only inside tools/loom-mcp/out/ in the repository.',
      inputSchema: {
        ...patternArguments,
        ...profileArguments,
        fileName: z.string().optional().describe('A bare file name ending in .bmp, such as design.bmp (the default). Letters, digits, dot, dash and underscore only.'),
        liftColour: z.enum(['black', 'white']).optional().describe('Colour of a lifted end. Default black.'),
        pickOrder: z.enum(['first-at-top', 'first-at-bottom']).optional().describe('Which side the first pick is on. Default first-at-top.'),
        endOrder: z.enum(['first-at-left', 'first-at-right']).optional().describe('Which side the first end is on. Default first-at-left.'),
      },
      outputSchema: { path: z.string(), bytes: z.number(), width: z.number(), height: z.number() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      guarded(() => {
        const target = repoGuard.writable(args.fileName ?? 'design.bmp');
        const profile = resolveProfile({ inline: args.profile, path: args.profilePath }, true);
        const pattern = resolvePattern({ inline: args.pattern, path: args.patternPath });
        const options = { bitDepth: 1, liftColour: args.liftColour, pickOrder: args.pickOrder, endOrder: args.endOrder };
        const exported = exportPatternBmp(profile, pattern, Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)));
        if (!exported.ok) {
          const reason = exported.failure.reason;
          if (reason === 'invalid-card') {
            const picks = exported.failure.picks.map((entry) => entry.pick + 1).slice(0, 10).join(', ');
            return failure('invalid-card', `Some cards are not valid cards of the profile (picks ${picks}).`, 'Repair or remove those cards, or run render_cloth to see the gaps.');
          }
          if (reason === 'empty-pattern') return failure('empty-pattern', 'The design has no picks.', 'Give a design with at least one card.');
          if (reason === 'invalid-options') return failure('invalid-options', `The option ${exported.failure.option} is not valid.`, exported.failure.message);
          throw new ToolError('invalid_profile', 'The card profile is not valid.', 'Run validate_profile on it.');
        }
        writeFileSync(target.absolute, exported.bytes);
        const bytes = statSync(target.absolute).size;
        const layout = bmpLayout(profile.hookRows * profile.hookColumns, pattern.length, 1);
        return succeed(
          { path: target.relative, bytes, width: layout.width, height: layout.height },
          `Wrote ${target.relative}: ${bytes} bytes, ${layout.width} ends by ${layout.height} picks, 1-bit.`,
        );
      }),
  );
}
