/**
 * `npm run check:deployed -- [<url>]`: checks the deployed app over HTTP with Node's built-in fetch.
 * The default URL is https://naqsha-ashen.vercel.app/. Exit code is non-zero if any step failed.
 * The logic is in scripts/checks/deployed.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractPageAssets, parseArgs, runDeployedChecks } from './checks/deployed.ts';
import { exitCodeFor, formatResult, formatSummary } from './checks/report.ts';

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`check:deployed: ${args.message}`);
    return 1;
  }
  const indexHtml = readFileSync(path.resolve(import.meta.dirname, '..', 'index.html'), 'utf8');
  const expectedTitle = extractPageAssets(indexHtml).title;
  if (expectedTitle === null) {
    console.error('check:deployed: local index.html has no title');
    return 1;
  }
  console.log(`checking ${args.url}`);
  const report = await runDeployedChecks({
    fetch: (url, init) => fetch(url, init),
    url: args.url,
    expectedTitle,
    onResult: (result) => console.log(formatResult(result)),
  });
  for (const line of report.info) console.log(`\nINFO  ${line.split('\n').join('\n      ')}`);
  console.log(formatSummary(report.results));
  return exitCodeFor(report.results);
}

process.exitCode = await main();
