import { z } from 'zod';
/** The profile arguments every profile-taking tool accepts: inline JSON, or a path under the repository. */
export const profileArguments = {
  profile: z.record(z.string(), z.unknown()).optional().describe('A card profile as JSON. Give this or profilePath.'),
  profilePath: z.string().optional().describe('Path of a card profile JSON file inside the repository, for example public/profiles/demo-12x16.json.'),
};
/** The pattern arguments: a list of cards inline, or the path of a design file. A card is a list of hook rows of true and false; null is a lost card. */
export const patternArguments = {
  pattern: z.array(z.unknown()).optional().describe('The design as a list of cards, one per pick. Each card is a list of hook rows, each a list of true (punched hole) and false. Give this or patternPath.'),
  patternPath: z.string().optional().describe('Path of a design JSON file inside the repository: a list of cards, or an object with a "pattern" list.'),
};
/** Annotations: none of these tools reaches outside the repository. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
