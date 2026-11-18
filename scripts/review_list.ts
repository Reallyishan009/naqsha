/**
 * Writes docs/HINDI_REVIEW.md: every Hindi string whose reviewed flag is not true.
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   npm run review-list
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dictionary, HiDictionary } from '../src/ui/types.ts';
import { renderReviewMarkdown, reviewList } from '../src/ui/i18n/reviewList.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const en = JSON.parse(readFileSync(join(repoRoot, 'src/ui/i18n/en.json'), 'utf8')) as Dictionary;
const hi = JSON.parse(readFileSync(join(repoRoot, 'src/ui/i18n/hi.json'), 'utf8')) as HiDictionary;
writeFileSync(join(repoRoot, 'docs/HINDI_REVIEW.md'), renderReviewMarkdown(reviewList(hi, en)));
