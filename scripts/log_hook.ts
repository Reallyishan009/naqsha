/**
 * `node scripts/log_hook.ts <hook-name> <result>`: appends ONE line (ISO timestamp, hook name, result)
 * to logs/hooks.log. Called by the command of each hook in .kiro/hooks after the real work, with the
 * exit status as the result. The line format is in scripts/checks/hooksLog.ts.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { HOOKS_LOG_PATH, formatHookLogLine } from './checks/hooksLog.ts';

const [hook, result] = process.argv.slice(2);
if (hook === undefined || hook === '' || result === undefined || result === '') {
  console.error('usage: node scripts/log_hook.ts <hook-name> <result>');
  process.exit(2);
}
const file = path.resolve(import.meta.dirname, '..', HOOKS_LOG_PATH);
mkdirSync(path.dirname(file), { recursive: true });
appendFileSync(file, `${formatHookLogLine({ at: new Date().toISOString(), hook, result })}\n`);
