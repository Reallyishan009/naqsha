/**
 * Dev tool, `node scripts/real_card_reads.ts`: presses each real card photo of the Scan screen's Demo cards in headless
 * Chrome against `vite preview` of dist/ and prints what Naqsha's reader returned (a read with its punched-hole count, or
 * the failure message). It does not change the reader and fakes nothing. Needs Chrome (CHROME_PATH) and a built dist/.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from './checks/chrome.ts';
import { Page, openPage, sleep, startChrome, startPreview } from './checks/session.ts';
import type { Cleanup } from './checks/session.ts';

const root = path.resolve(import.meta.dirname, '..');
const EN = JSON.parse(readFileSync(path.join(root, 'src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;
const REAL_FILES = readdirSync(path.join(root, 'public/demo/real-cards')).filter((name) => name.endsWith('.jpg')).sort();
const failureKeys = Object.keys(EN).filter((key) => key.startsWith('error.read.') && key !== 'error.read.details');

const cleanups: Cleanup[] = [];
try {
  const chrome = findChrome(process.platform, process.env, existsSync);
  if (!chrome.ok) throw new Error(chrome.message);
  const { url } = await startPreview(cleanups);
  const { port } = await startChrome(chrome.path, cleanups);
  const cdp = await openPage(port);
  cleanups.push(async () => cdp.close());
  const page = new Page(cdp);
  await page.init(mkdtempSync(path.join(os.tmpdir(), 'naqsha-reads-')));
  await page.setViewport(1280, 1000);
  await page.navigate(url);
  await page.ev(`localStorage.setItem('naqsha.language','en')`);
  await page.navigate(url);
  await page.click(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim().startsWith('Scan'))`, 'the Scan item');
  await page.waitFor(`!!document.querySelector('#scan-file')`, 'the Scan screen');
  const results: string[] = [];
  for (const file of REAL_FILES) {
    await page.ev(`(()=>{document.querySelector('#scan-read-title')&&[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(EN['scan.discard'])})?.click()})()`);
    await sleep(300);
    await page.click(`document.querySelector('[data-demo="${file}"]')`, file);
    // The last result stays on screen until this press starts its read, so wait before looking.
    await sleep(2000);
    const failures = JSON.stringify(failureKeys.map((key) => [key, EN[key]]));
    const outcome = await page.waitFor<string>(
      `(()=>{if(document.querySelector('#scan-read-title')){const m=[...document.querySelectorAll('[aria-label]')].filter(e=>e.getAttribute('aria-label').includes(${JSON.stringify(EN['scan.marker.punched'])})&&!e.getAttribute('aria-label').includes(${JSON.stringify(EN['scan.marker.unpunched'])})).length;return 'read; '+m+' punched hooks marked'}const f=${failures}.find(([k,t])=>document.body.textContent.includes(t));return f?'failed; '+f[0]+': '+f[1]:null})()`,
      `a result for ${file}`,
      30_000,
    );
    results.push(`| ${file} | ${outcome.replace(/\|/g, '/')} |`);
  }
  console.log(['| File | Reader returned |', '| --- | --- |', ...results].join('\n'));
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup().catch(() => undefined);
}
