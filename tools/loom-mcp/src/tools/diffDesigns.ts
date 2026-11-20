import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { diffPatterns, diffToText, patternToLines } from '../../../../src/codec-view/index.ts';
import type { DiffRefusal } from '../../../../src/codec-view/index.ts';
import { resolvePattern, resolveProfile } from '../input.ts';
import { ToolError, failure, guarded, succeed } from '../result.ts';
import { READ_ONLY, profileArguments } from './shared.ts';
const side = z.object({
  pattern: z.array(z.unknown()).optional().describe('The design as a list of cards. Give this or path.'),
  path: z.string().optional().describe('Path of a design JSON file inside the repository.'),
});
/** The refusal's own values, as one sentence. */
function refusalHint(refusal: DiffRefusal): string {
  switch (refusal.reason) {
    case 'dimension-mismatch':
      return `The first design has ${refusal.first.hookRows} hook rows by ${refusal.first.hookColumns} hook columns and the second ${refusal.second.hookRows} by ${refusal.second.hookColumns}. Compare designs made for the same card.`;
    case 'profile-mismatch':
      return `The first design is for the profile "${refusal.firstProfileName}" and the second for "${refusal.secondProfileName}". Compare designs made for the same card profile.`;
    case 'too-many-picks':
      return `The designs have ${refusal.firstPicks} and ${refusal.secondPicks} picks; the most that can be compared is ${refusal.limit}. Compare shorter designs.`;
    default: {
      const unreachable: never = refusal;
      return unreachable;
    }
  }
}
export function registerDiffDesigns(server: McpServer): void {
  server.registerTool(
    'diff_designs',
    {
      title: 'Compare two designs',
      description:
        'Compares two designs for the same card profile pick by pick and returns the changes as text (the same Diff text the Code view copies) with counts of changed holes, added cards and removed cards. Use it to see what changed between two versions.',
      inputSchema: { first: side, second: side, ...profileArguments },
      outputSchema: {
        text: z.string(),
        identical: z.boolean(),
        counts: z.object({ changedHoles: z.number(), addedCards: z.number(), removedCards: z.number() }),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      guarded(() => {
        const profile = resolveProfile({ inline: args.profile, path: args.profilePath }, true);
        const first = resolvePattern({ inline: args.first.pattern, path: args.first.path }, 'first design');
        const second = resolvePattern({ inline: args.second.pattern, path: args.second.path }, 'second design');
        const firstLines = patternToLines(profile, first);
        const secondLines = patternToLines(profile, second);
        if (!firstLines.ok || !secondLines.ok) throw new ToolError('invalid_pattern', 'A design is not a list of cards.', 'Give each design as a list of cards.');
        const diff = diffPatterns(
          firstLines.lineSet,
          secondLines.lineSet,
        );
        if (!diff.ok) return failure(diff.refusal.reason, `The designs cannot be compared (${diff.refusal.reason}).`, refusalHint(diff.refusal));
        const identical = diff.counts.changedHoles === 0 && diff.counts.addedCards === 0 && diff.counts.removedCards === 0;
        return succeed(
          { text: diffToText(diff), identical, counts: diff.counts },
          identical
            ? 'The two designs are identical.'
            : `${diff.counts.changedHoles} changed hole${diff.counts.changedHoles === 1 ? '' : 's'}, ${diff.counts.addedCards} added card${diff.counts.addedCards === 1 ? '' : 's'}, ${diff.counts.removedCards} removed card${diff.counts.removedCards === 1 ? '' : 's'}.\n\n${diffToText(diff)}`,
        );
      }),
  );
}
