/**
 * `npm run check:hooks`: prints the last 20 lines of logs/hooks.log and, for each hook in .kiro/hooks,
 * whether it has fired. A hook counts as fired only if the log holds a line for it. Read-only: it never
 * creates or edits the log. The logic is in scripts/checks/hooksLog.ts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { HOOKS_LOG_PATH, describeSummary, lastLines, readHookNames, summarizeHooks } from './checks/hooksLog.ts';

const root = path.resolve(import.meta.dirname, '..');
const hooksDir = path.join(root, '.kiro', 'hooks');

function readLog(): string {
  try {
    return readFileSync(path.join(root, HOOKS_LOG_PATH), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

const logText = readLog();
const tail = lastLines(logText, 20);
console.log(`last ${tail.length} line(s) of ${HOOKS_LOG_PATH}${logText === '' ? ' (no log file or it is empty)' : ''}:`);
for (const line of tail) console.log(`  ${line}`);

const names: string[] = [];
let problems = 0;
for (const file of readdirSync(hooksDir).filter((f) => f.endsWith('.json')).sort()) {
  const read = readHookNames(readFileSync(path.join(hooksDir, file), 'utf8'));
  if (read.ok) names.push(...read.names);
  else {
    problems += 1;
    console.log(`PROBLEM ${file}: ${read.message}`);
  }
}
const { hooks, malformed } = summarizeHooks(logText, names);
console.log('\nhooks:');
for (const summary of hooks) console.log(`  ${describeSummary(summary)}`);
for (const line of malformed) {
  problems += 1;
  console.log(`MALFORMED log line (not counted): ${JSON.stringify(line)}`);
}
process.exit(problems === 0 ? 0 : 1);
