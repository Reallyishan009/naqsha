---
inclusion: manual
---
# Naqsha — Pre-release check

Run this before a release or a push to the shared branch. Include it in chat with `#prerelease-check`, or pick it from the `/` menu.

Run the four items below **in order**, from the repository root. Report each item as **PASS** or **FAIL**, and under each one paste the real output of the commands (the last lines are enough when the output is long, but the summary lines must be there). Rules:

- Never mark an item PASS without its output. If a command did not run, the item is FAIL and you say why.
- Never weaken a check to make it pass: do not skip a step, edit a test, lower a limit, add an ignore, or change a check script. If something fails, report it and stop to ask.
- Do not run the next item's fixes for the user. Report, then continue with the remaining items so the user sees every result.
- Do not push, tag or publish.

## 1. `npm run check:all`

Covers: tests, typecheck, build, bundle size, `.kiro` not git-ignored, `LICENSE` exists, no secrets in tracked files, README has no "coming" text. Report the full list of PASS/FAIL lines and the summary.

## 2. `npm run check:browser`

Needs Google Chrome (set `CHROME_PATH` if it is not found) and a built `dist/`. It drives a real headless Chrome through 13 steps. Step 13 is "works with the network off":

The step first loads the site online with a plain navigation and waits until the service worker controls the page. Then it takes the network away for real: `Network.emulateNetworkConditions` with `offline: true` (Chrome's HTTP cache left enabled, because disabling it makes requests bypass the service worker) **and** the `vite preview` server is stopped, since Chrome's network emulation does not reach the worker's own requests. It then shows that the worker's cache is what answers: a response put only in that cache, at an address the server never served, comes back through `fetch`.

- A. the page is **not** reloaded: the network is confirmed off (a request for an uncached address fails while the card profile still reads), a Try it sample plays to its last pick, language switching works, the **first** Scan open works (the lazy chunk comes from the cache) and a 1-bit BMP export works.
- B. the page is reloaded with no network at all: the app must be on screen, and then the same checks run again on the reloaded page, including Weave rendering.

Report every step line and the summary, and for step 13 the A and B results separately, with the note of every sub-check. If the reload in B fails, the later B checks are reported NOT RUN, never PASS. A failure here is a real finding about R13 and R24: report it with the evidence in the output and do not weaken the step.

## 3. Clean clone

Proves the README run steps work from nothing. Use a fresh temporary directory:

1. `tmp=$(mktemp -d)`
2. `git clone "$(pwd)" "$tmp/naqsha"` (a clone has only committed files, so uncommitted work is not tested; say so if `git status --short` shows changes)
3. In `$tmp/naqsha`: `npm ci`, then `npm run build`, then `npm run test:run`.
4. `rm -rf "$tmp"` (only this temporary directory).

PASS only if all three npm commands exit 0. Report the output of each, and the exit code.

## 4. Build log is up to date

1. Newest log entry date: the last `## YYYY-MM-DD` heading in `docs/BUILD_LOG.md` (for example `grep -E '^## [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/BUILD_LOG.md | tail -1`).
2. Latest commit date: `git log -1 --format=%cs`.
3. Latest commit that is not a log-only commit: `git log -1 --format=%cs -- . ':(exclude)docs/BUILD_LOG.md'`.

FAIL if the log date is older than the date from step 3. Print all three dates. Dates have day resolution only, so a log entry from the same day as the commit passes even if it was written earlier that day; say so.

## Final report

A table with the four items and PASS or FAIL, then the real output under each. List anything not verified.

## Notes

- `KIRO_PROMPTS.md` (prompt 39) was searched for in the repository (`git ls-files` and the filesystem) and does not exist, so this list comes from the user's own list: tests pass, `.kiro` not ignored, `LICENSE` exists, README run steps work from a clean clone, no API keys, the app loads with the network off, the build log is up to date. Item 1 covers the first five (no API keys is the secrets check), item 2 covers the network-off check, item 3 the clean clone, item 4 the build log.
- Front matter source: https://kiro.dev/docs/steering/ lists `inclusion: manual` and says manual steering files can be included with `#steering-file-name` in chat and also appear as slash commands (type `/` in chat). The other steering files in this folder use the same `---` block (`card-geometry.md` uses `inclusion: fileMatch`). The docs do not say whether the slash menu shows the file name or a title, so this file does not claim either. The name is `prerelease-check` (the file name) and the title is "Naqsha — Pre-release check". Not verified in the IDE: that the `/` menu lists this file.
