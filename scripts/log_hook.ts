/**
 * `node scripts/log_hook.ts <hook-name> <result>`: appends ONE line (ISO timestamp, hook name, result)
 * to logs/hooks.log. Called by .kiro/hooks/bin/run-logged.sh, which each hook command runs, with the
 * exit status or a timeout as the result. The line format is in scripts/checks/hooksLog.ts.
 *
 * `NAQSHA_HOOKS_LOG` sends the line to another file instead. It exists so the timeout behaviour of
 * the wrapper can be verified without writing into logs/hooks.log, which is the hooks' own evidence
 * and must hold lines from real hook runs only.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { HOOKS_LOG_PATH, formatHookLogLine } from './checks/hooksLog.ts';

const [hook, result] = process.argv.slice(2);
if (hook === undefined || hook === '' || result === undefined || result === '') {
  console.error('usage: node scripts/log_hook.ts <hook-name> <result>');
  process.exit(2);
}
const override = process.env.NAQSHA_HOOKS_LOG;
const file =
  override === undefined || override === ''
    ? path.resolve(import.meta.dirname, '..', HOOKS_LOG_PATH)
    : path.resolve(override);
mkdirSync(path.dirname(file), { recursive: true });
appendFileSync(file, `${formatHookLogLine({ at: new Date().toISOString(), hook, result })}\n`);
