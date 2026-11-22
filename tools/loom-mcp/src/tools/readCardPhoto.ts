import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { cardToBits } from '../../../../src/codec-view/index.ts';
import { readCard } from '../../../../src/reader/index.ts';
import type { ReadFailure } from '../../../../src/reader/index.ts';
import { LIMITS } from '../limits.ts';
import { readBoundedFile, resolveProfile } from '../input.ts';
import { repoGuard } from '../paths.ts';
import { decodePng } from '../png.ts';
import { ToolError, failure, guarded, succeed } from '../result.ts';
import { READ_ONLY, profileArguments } from './shared.ts';
/** One sentence, at most 200 characters, naming one photo change that addresses each reason the reader can give. */
export const PHOTO_HINTS: Record<ReadFailure['reason'], string> = {
  'invalid-profile': 'Run validate_profile on the card profile and fix what it reports.',
  'invalid-image': 'Give a PNG whose pixels can be read: 8-bit, not interlaced, with a width and height above zero.',
  'peg-holes-not-found': 'Photograph the whole card in even light, flat to the camera, so both peg holes show as clear dark circles.',
  'ambiguous-orientation': 'Photograph the card so the two peg holes differ clearly in size, and keep it upright and square to the camera.',
  'resolution-too-low': 'Take the photo closer or at a higher resolution so each hole is at least the number of pixels the reader needs.',
  'card-outside-image': 'Frame the card so all four edges are inside the photo, with a margin around it.',
};
export function registerReadCardPhoto(server: McpServer): void {
  server.registerTool(
    'read_card_photo',
    {
      title: 'Read a photo of a punch card',
      description:
        'Reads a PNG photo of one punch card and returns which hook positions are punched, as a bit line (one 1 or 0 per end) and per hook row. If the card cannot be read it says why and how to retake the photo.',
      inputSchema: {
        path: z.string().describe('Path of the PNG photo inside the repository, for example tests/fixtures/pick0-clean.png.'),
        ...profileArguments,
      },
      outputSchema: {
        bitLine: z.string(),
        hookRows: z.array(z.string()),
        hookRowCount: z.number(),
        hookColumnCount: z.number(),
        endsPerPick: z.number(),
        tiltDegrees: z.number(),
        orientation: z.string(),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      guarded(() => {
        const profile = resolveProfile({ inline: args.profile, path: args.profilePath }, true);
        const bytes = readBoundedFile(repoGuard, args.path, LIMITS.pngFileBytes, 'The PNG file');
        const pixels = decodePng(bytes);
        const read = readCard(profile, pixels);
        if (!read.ok) {
          const reason = read.failure.reason;
          const detail = read.failure.reason === 'invalid-image' ? ` ${read.failure.detail}.` : '';
          return failure(reason, `The card could not be read (${reason}).${detail}`.trim(), PHOTO_HINTS[reason]);
        }
        const bits = cardToBits(profile, read.grid);
        if (!bits.ok) throw new ToolError('internal_error', 'The card was read but could not be written as bits.', 'Report this.');
        const hookRows = read.grid.map((hookRow) => hookRow.map((punched) => (punched ? '1' : '0')).join(''));
        return succeed(
          {
            bitLine: bits.bits,
            hookRows,
            hookRowCount: profile.hookRows,
            hookColumnCount: profile.hookColumns,
            endsPerPick: bits.bits.length,
            tiltDegrees: read.pose.tiltDegrees,
            orientation: read.pose.orientation,
          },
          `Read a card of ${profile.hookRows} hook rows by ${profile.hookColumns} hook columns (${read.pose.orientation}, tilt ${read.pose.tiltDegrees.toFixed(1)} degrees).\nBit line: ${bits.bits}\n${hookRows.join('\n')}`,
        );
      }),
  );
}
