import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { endsPerPick, parseCardProfile } from '../../../../src/codec/index.ts';
import { checkInline, loadJsonFile, violationSentence } from '../input.ts';
import { ToolError, guarded, succeed } from '../result.ts';
import { READ_ONLY } from './shared.ts';
export function registerValidateProfile(server: McpServer): void {
  server.registerTool(
    'validate_profile',
    {
      title: 'Validate a card profile',
      description:
        'Checks a card profile (the layout of one punch card: hook rows and columns, hole size, pitch, end order, peg holes) and says in plain words what is wrong with it. Give the profile inline or as a path inside the repository.',
      inputSchema: {
        profile: z.record(z.string(), z.unknown()).optional().describe('A card profile as JSON. Give this or path.'),
        path: z.string().optional().describe('Path of a card profile JSON file inside the repository, for example public/profiles/demo-12x16.json.'),
      },
      outputSchema: {
        valid: z.boolean(),
        name: z.string().optional(),
        hookRows: z.number().optional(),
        hookColumns: z.number().optional(),
        endsPerPick: z.number().optional(),
        violations: z.array(z.object({ kind: z.string(), location: z.string(), sentence: z.string() })),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      guarded(() => {
        if ((args.profile === undefined) === (args.path === undefined)) {
          throw new ToolError('invalid_option', 'Give exactly one of profile and path.', 'Pass the profile inline, or the path of a profile file.');
        }
        let value: unknown;
        if (args.profile !== undefined) {
          checkInline(args.profile, 'card profile');
          value = args.profile;
        } else {
          value = loadJsonFile(args.path);
        }
        const parsed = parseCardProfile(value);
        if (!parsed.ok) {
          const violations = parsed.violations.map((violation) => ({
            kind: violation.kind,
            location: violation.location,
            sentence: violationSentence(violation),
          }));
          const text = [`The card profile is not valid: ${violations.length} problem${violations.length === 1 ? '' : 's'}.`, ...violations.map((violation) => `- ${violation.sentence}`)].join('\n');
          return succeed({ valid: false, violations }, text);
        }
        const profile = parsed.value;
        return succeed(
          { valid: true, name: profile.name, hookRows: profile.hookRows, hookColumns: profile.hookColumns, endsPerPick: endsPerPick(profile), violations: [] },
          `The card profile "${profile.name}" is valid: ${profile.hookRows} hook rows by ${profile.hookColumns} hook columns, ${endsPerPick(profile)} ends per pick.`,
        );
      }),
  );
}
