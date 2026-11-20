# How Kiro was used on Naqsha

This file is written only from what is in the repository: `.kiro/`, `docs/BUILD_LOG.md`, `git log` and `tests/`. Where the repository has no evidence, it says "no evidence in the repository". Commit hashes are short hashes from `git log`.

## 8. Authorship (stated first so it is not missed)

Planning and prompt drafting were done with Claude (BUILD_LOG, entry 2026-11-13 to 2026-11-14: "Claude, for brainstorming, web research, and planning. No Kiro credits used"). Kiro wrote the specs and the code. BUILD_LOG records "No files edited by hand" in every entry from 2026-11-18 on. The author's part was review, approval and decisions (for example approving or rejecting a requirement change).

The planning files named in that entry (`PLAN.md`, `KIRO_PROMPTS.md`, `RESEARCH.md`, `WEAVER_INTERVIEW.md`, `CARD_MEASUREMENT.md`, `SUBMISSION_DRAFT.md`) are not in this repository. Only `docs/DESIGN_BRIEF.md`, `docs/BUILD_LOG.md` and `docs/HINDI_REVIEW.md` are. The prompt numbers from `KIRO_PROMPTS.md` were not recorded during sessions.

## 1. Specs

Six specs exist in `.kiro/specs/` (the first four are in the table; `cards-as-code`, `version-history` and `repair-suggestions` are described in BUILD_LOG). Each has `requirements.md`, `design.md` and `tasks.md`. Each also has a `tasks.meta.json` (execution records written by Kiro; only the `app` one is tracked in git, the other three are untracked).

| Spec | Requirements | Design properties | Extra files |
|---|---|---|---|
| `card-codec-and-reader` | 19 | 87 | `measurements.md`, `parked-5.14-readCard-tests.patch` |
| `simulator` | 14 | 26 | `measurements.md` |
| `exporter` | 12 | 19 | none |
| `app` | 24 | 43 | `.config.kiro` (workflow type `requirements-first`, spec type `feature`) |

Counts come from counting `### Requirement` and `### Property` headings today. BUILD_LOG reports earlier counts (83 and 24 properties for the first two) because the specs grew; the growth is recorded below (R2.10, R2.11 and others). The `app` spec was at 23 requirements and 39 properties until task 8.1 added Requirement 24 (the service worker, 24.1 to 24.8), amended R13.1 and R16.10, and added Properties 40 to 43; that was the only spec change in Phase 8, and the user authorised it.

**Example: one requirement traced to a design property, a task and a test.**

- Requirement: `card-codec-and-reader/requirements.md`, Requirement 9, criterion 3: "THE reader SHALL NOT mistake punched holes or lacing holes for peg holes."
- Design property: `card-codec-and-reader/design.md`, "Property 55: R9.3 punched holes and lacing holes are not mistaken for peg holes", with "Validates: Requirements 9.3" and the test file named as `tests/reader/pegHoles.test.ts`.
- Task: `card-codec-and-reader/tasks.md`, task 5.11 adds Properties 54 and 55 as "not cuttable because they check decoy rejection". Task 5.16 later says "retarget Property 55" to `selectPegHolePair`.
- Test: `tests/reader/pegHoles.test.ts`, the block commented "Property 55" (around line 180), and `tests/reader/layout.test.ts` titles beginning "R9.3".

This chain is also the decoy peg pair bug in section 5.

**Example of a spec changing during the build.** `card-codec-and-reader/requirements.md` gained criterion R2.10 (profile `name` must be a string, commit `f6b7e75`) and R2.11 (overlapping holes rejected, commit `d8f047f`). Both were added by the user's decision after a test or generator exposed a gap. See section 5.

### The `version-history` spec (one unattended run)
A fifth spec, `.kiro/specs/version-history/`, was written in one run with no review stop: `requirements.md` (8 requirements, 15 criteria, the cap the user set), `design.md` (one page, one correctness property) and `tasks.md` (12 tasks in four groups, one git commit per group). The Kiro requirement-detailing step ran once per requirement and was told to keep the criteria count; it still changed R2.1 (it added a failure for a note over 200 characters), and `BUILD_LOG.md` records how that was reconciled with the three archive failure reasons. The code was then written group by group; the steering glossary and `structure.md` were updated in the last group. See the BUILD_LOG entry "version-history" for what changed, the tests that were edited on purpose, and what was not run (no browser, no `check:browser`, no `check:all`).
### The `repair-suggestions` spec (second unattended run)
A sixth spec, `.kiro/specs/repair-suggestions/`, was written the same way: `requirements.md` (8 requirements, 15 criteria), `design.md` (one page, exactly two correctness properties) and `tasks.md` (12 tasks, four groups, one commit per group), then built without a review stop. The detailing step again ran once per requirement. One thing it changed was reconciled by hand: it wrote "SHALL NOT rank" for conflicting suggestions, which contradicts "ordered best first", so the criterion now says the module returns both and does not merge or drop either. The design's own warning that property 1 might fail (a shorter period agreeing by chance) was tested with 5,000 runs per property and did not occur. See the BUILD_LOG entry "repair-suggestions" for the thresholds, what was not run (no browser, no `check:browser`, no `check:all`) and the entry size.
## 2. Steering docs

Seven files in `.kiro/steering/`. Five are always loaded; `card-geometry.md` has front matter `inclusion: fileMatch` with `fileMatchPattern: "src/{codec,reader}/**"`; `prerelease-check.md` has `inclusion: manual` (see "Steering command" below).

| File | What it constrains |
|---|---|
| `product.md` | What Naqsha is, the three user personas, the four journeys, the non-goals (no server, no accounts, no dobby looms) and the success criteria. |
| `tech.md` | Stack (Vite, React, strict TypeScript, Vitest, fast-check, Canvas 2D, IndexedDB), no heavy image libraries, CSS Modules only, `.ts` import extensions in `src/codec`, performance budgets (200 KB gzipped JS, 300 ms for hole detection on 1080p, 16 ms per simulation frame). |
| `structure.md` | Directory layout, what each `src/` module may import, file naming, and the key exports of each module. Kiro updated it as modules were added (BUILD_LOG: exporter phase 1, simulator phase 4, app phase 2). |
| `weaving-glossary.md` | Domain terms to use in identifiers and comments (`pick`, `end`, `hook`, `punched hole`, `float`, `zari` and so on). |
| `card-geometry.md` | One card is one pick; a punched hole lifts the hook; the card layout is a runtime profile and never hard-coded in `src/codec` or `src/reader`. Its layout table is marked ILLUSTRATIVE, UNVERIFIED. |
| `testing.md` | Every pure function in four modules needs a fast-check property; properties are named after the requirement they check; fixtures use fixed seeds; and "Never weaken a property silently". |

### Steering command: `prerelease-check.md`

`.kiro/steering/prerelease-check.md` has front matter `inclusion: manual`. Source: https://kiro.dev/docs/steering/, which says manual steering files are included with `#steering-file-name` in chat and also appear as slash commands (type `/`). It was added in task 7.3 (`7e8de62`). It tells the agent to run four items in order and report PASS or FAIL with the real output of each, never to weaken a check, and never to push, tag or publish:

1. `npm run check:all` (tests, typecheck, build, bundle size, `.kiro` not git-ignored, `LICENSE`, no secrets in tracked files, no "coming" text in the README).
2. `npm run check:browser` (headless Chrome, 13 steps, step 13 is "works with the network off").
3. A clean clone in a temporary directory: `npm ci`, `npm run build`, `npm run test:run`.
4. The newest `docs/BUILD_LOG.md` date against the latest commit dates.

**Not verified:** the command has not been run end to end in the IDE. Its four items were run separately as npm scripts or by hand, not through the steering file. The label the `/` menu shows for it (file name or title) is unverified; the Kiro docs do not say, and the file claims neither. That the `/` menu lists it at all is also unverified.

**`KIRO_PROMPTS.md` is not in the repository** (searched with `git ls-files` and the filesystem), so prompts 38 and 39 could not be read. The custom agent (prompt 38) and this steering command (prompt 39) follow the user's own descriptions of them.

**Which one helped most: this is a judgement.** BUILD_LOG never says "steering rule X caused Y", so the repository cannot prove a ranking. The closest evidence points to `testing.md`:

- Its rule "Never weaken a property silently" matches how the log reports every weakened test. Each of these is flagged for the user's confirmation: Property 46 (`36e1e28`), Property 6 of the simulator (`9e3f6b5`), Property 18 of the archive, Property 11 (R2.8) and the edited counterexamples in `tests/reader/resolution.test.ts` (`d8f047f`), and the narrowed `tests/ui/structure.test.ts` assertion (`a4e2617`).
- Its rule that property names start with a requirement ID is enforced by a structure test (`92205db`, "Add property naming and coverage structure test"), and the task 3.9 coverage check relied on those IDs to find 55 untested criteria.

`card-geometry.md` is the second candidate: its "no hard-coded dimensions" rule is why the fixtures, tests and `scripts/time_read_card.ts` all take a profile. The log gives no case where it caught a mistake.

## 3. Hooks

Two hook files in `.kiro/hooks/`, each with a script in `.kiro/hooks/bin/`. Both were created in the housekeeping step of 2026-11-18 (`f81656c`, `300cf0a`).

| File | Trigger | Matcher | Action | Timeout |
|---|---|---|---|---|
| `test-on-save.json` ("Related tests and typecheck on save") | `PostFileSave` | `src` or `scripts` `.ts` or `.tsx` files | command: `node .kiro/hooks/bin/related-tests.mjs` (runs the Vitest files related to the saved file, then `tsc --noEmit`), since task 8.4 through `.kiro/hooks/bin/run-logged.sh` with a 110 s deadline | 120 s (10 s until task 8.4) |
| `fixtures-on-profile-change.json` ("Regenerate fixtures on profile or generator change") | `PostFileSave` | `public/profiles/*.json` or `scripts/make_fixtures.ts` | command: `sh .kiro/hooks/bin/check-fixtures.sh` (regenerates `tests/fixtures/`, exits 1 if any PNG byte changed), since task 8.5 through `.kiro/hooks/bin/run-logged.sh` with a 50 s deadline | 60 s (unchanged: its slowest measured run is 0.77 s) |

Task 7.2 (`f8a7be8`) changed both commands. Each ran its script, then `node scripts/log_hook.ts "<hook name>" "exit <status>"`, then exited with the script's own status, so the hook result is unchanged. That shape writes no line at all if the runner kills the process, so task 8.4 put the related-tests hook through `.kiro/hooks/bin/run-logged.sh` and task 8.5 did the same for the fixtures hook; **neither hook now uses the old shape**. `scripts/log_hook.ts` appends one line (ISO timestamp, tab, hook name, tab, result) to `logs/hooks.log`. `logs/` is git-ignored (`.gitignore` line 11). `npm run check:hooks` (`scripts/check_hooks.ts`, read-only) prints the last 20 log lines and, per hook, how many times it fired, when last, and how many of those runs timed out.

**Did they fire? One of them, many times. Real output of `npm run check:hooks`, run while writing this file** (the last 3 of the 20 lines it prints, then its summary):

```
  2026-11-20T04:14:06.293Z	Related tests and typecheck on save	exit 0
  2026-11-20T04:14:17.978Z	Related tests and typecheck on save	exit 0
  2026-11-20T04:19:50.376Z	Related tests and typecheck on save	exit 0
hooks:
  Regenerate fixtures on profile or generator change: never fired (no log line)
  Related tests and typecheck on save: fired 68 times, last at 2026-11-20T04:19:50.376Z
```

- `Regenerate fixtures on profile or generator change`: **never fired** (no log line). Nobody has saved `public/profiles/*.json` or `scripts/make_fixtures.ts` in the IDE since the logging was added, as far as the log shows.
- `Related tests and typecheck on save`: **68 lines now, where this section first recorded 3.** They are `exit 0` and `exit 1` only; no line reports a timeout, and the `exit 1` runs are related tests that really failed during editing. The count grew across tasks 7.3 to 8.4 as files under `src/` and `scripts/` were saved, which is what the hook fires on. **Unverified:** a log line does not say who ran the command, so the log alone cannot prove the IDE wrote them rather than a person running the script by hand. I wrote none by hand, and the suite writes to a temporary file (`NAQSHA_HOOKS_LOG`), never to `logs/hooks.log`.
- **Timeout risk, measured and fixed in tasks 8.4 and 8.5.** When this section was written the related-tests timeout was 10 s, a line was written only if the command reached its end, and neither script had been timed. Task 8.4 timed the related-tests command (20 real runs: 0.55 s minimum for a file with no related test, 35.96 s maximum for a codec file whose related set is 54 of 96 test files), so saves of a codec file were being killed with no line; its timeout is now 120 s with a 110 s wrapper deadline. Task 8.5 timed the fixtures script (7 runs: min 0.42 s, median 0.42 s, max 0.77 s), which fits its 60 s timeout about 78 times over, so that timeout was left alone and only the wrapper was added, with a 50 s deadline. The wrapper writes a `timed out (…)` line from a `trap` on `TERM`/`INT`/`EXIT` or from its own deadline, and still passes the exit status through. The numbers, the Kiro documentation on the unit (seconds) and the real simulated-timeout lines for both hooks are in `docs/BUILD_LOG.md` (tasks 8.4 and 8.5). **Unverified:** how many saves were killed at the old 10 s timeout and left no line, and which signal the runner sends at a timeout (the Kiro docs do not say; the wrapper does not depend on the answer, and only SIGKILL could leave no line).
- The field in the hook's stdin that holds the saved file path is undocumented, so `related-tests.mjs` falls back to `git status`. Whether the fallback was used in those three runs is not recorded.
- Task 7.2 listed what is not verified in the IDE: the label of each entry in the Agent Hooks panel and whether it shows a fired indicator. Still unverified.

Tests for the log format and the report are in `tests/scripts/hooksLog.test.ts` (examples and fast-check properties). `scripts/log_hook.ts` itself is not run in a test, because it writes to `logs/hooks.log`.

## 4. MCP

`.kiro/settings/mcp.json` configures one server, `context7` (`npx -y @upstash/context7-mcp`, key read from `CONTEXT7_API_KEY`, `autoApprove` for `resolve-library-id` and `query-docs`). Added in `a3dee72`.

**Use:** BUILD_LOG 2026-11-18 says "MCP (Context7, queried once to check browser API use)". That is the only record of use. The query text, the library, and what the answer changed are not recorded, and no commit message mentions Context7. `README.md` lists the server as "Configured". So: one use is recorded in the log, with no detail, and nothing else is known. Later entries (simulator, exporter, app) do not list MCP among features used.

## 5. Property-based tests: bugs and changes they led to

Each item has its source. "Log" means `docs/BUILD_LOG.md`. All properties use fast-check.

**1. Decoy peg pair (reader).** While measuring the R18.8 scale, `readCard` returned wrong grids at 2.75, 2.25 and 1.25 px/mm (67 to 71 of 192 hook positions wrong) because two punched holes of equal size can out-score the real peg holes. Fix: task 5.16, commit `75b5498` (layout check and best-explanation pair selection). Follow-ups in the same task: a decoy could still pass on sparse cards with no lacing holes, and the lacing-hole rule rejected cropped cards. Related: `92a1eb1` adds the `resolution-too-low` failure and an 11 px floor (task 5.17), because at about 1 px/mm a tiny punched hole vanished and the read returned a wrong grid. Sweeps of sparse cards, up to 3,000 cases per bin, found wrong grids up to the 9 to 10 px bin. The log calls the floor "a safety floor, not a fix for the cause". Source: Log 2026-11-18. The spec records it in `tasks.md` tasks 5.16 and 5.17 and in `measurements.md`.

Where the repository is less clear: the log says the bug was found "while measuring the R18.8 scale". It was not a failing property that exposed it first. Properties 54 and 55 (task 5.11) were written to check decoy rejection, but the log does not say they failed.

**2. Overlapping holes (R2.11).** Printable card Properties 37 and 38 (`tests/ui/printable/raster.test.ts`) failed with seeds 3701 and 3801. The shrunk counterexample had two lacing holes about 0.87 mm apart with a 1.5 mm hole diameter, which `validateCardProfile` accepted, so the printed discs overlapped. The user chose to change the requirement, not the property. Fix: new criterion R2.11 and violation kind `holes-overlap`, commit `d8f047f`; `e86b7ef` fixed a floating-point rounding error in the overlap test construction. New Properties 85, 86, 87 (87 compares the bounded check with a brute-force all-pairs check). fast-check paths are in the log's 2026-11-20 requirement-change entry. Source: Log 2026-11-20.

Side effects the log says needed the user's confirmation: Property 11 (R2.8) now moves both peg holes off the card, so it covers less than before; two saved counterexample profiles in `tests/reader/resolution.test.ts` had their lacing hole x values moved; `tests/support/profiles.ts` now keeps a 0.5 hole diameter gap. The log (task 3.7 entry) records that the user accepted these.

**3. Property 46 change (codec and reader).** The design asked that a disc's measured diameter be within 5% for discs of 6 to 40 px. Counterexample `[6, 0, 0]`: a 6 px disc on a pixel corner measures 6.38 px (6.4% off). This is pixel quantisation, not a code bug. The user approved changing the property to "within 1 px always, within 5% from 12 px"; `[6,0,0]` stays as a regression example. Commit `36e1e28` (`design.md` Property 46 text changed in the same commit). Source: Log 2026-11-18. Property 80 failed the same day on a dark-pixel count (6.3% off) from generator anti-aliasing and now uses a coverage-weighted area with the same 5% tolerance (commit `d72c412`).

**4. Property 5 changes (simulator).** The same number exists in all four specs. This is the simulator's Property 5 ("R2.3 a crossing shows the warp on the face exactly when its end is lifted"), changed twice:
- After the zari highlight was added (`7b146f8`), Property 5's crossing-centre sample landed on a highlight pixel for odd thread sizes. Counterexample: warp `#000000`, gold zari weft, t=3, 8x8 viewport, seed 20240611. The expected colour is now computed from the same highlight rule; arbitraries, `numRuns` and seed are unchanged. The log says the agent applied the fix before reporting, which the orchestrator had allowed in advance for this case. The log does not name the commit; the diff of `7b146f8` to `tests/simulator/render.test.ts` adds the highlight-aware expected colour in the R2.3 test, so I attribute the fix to it.
- After float highlighting was added, the expected colour includes the highlight blend (`9e3f6b5`, whose message says so, with Property 6 run with `floatHighlight` off by user decision).
- Property 5 also uses a filter that drops settings where a shaded warp colour equals a shaded weft colour (Log). That is a standing narrowing, disclosed in the log.

**5. Other bugs and changes the log records:**
- **Simulator Property 6** failed once float highlighting was on, because replacing a pick inside a float correctly changes neighbouring highlights. User decision: run it with highlighting off (`9e3f6b5`).
- **Simulator Property 23** failed: the zari highlight and gap hatch were drawn at absolute x positions, so rows did not tile unless the base width was a multiple of 4 and 6 (counterexample: 2x5 hooks, t=3, base width 30, gold zari). Design changed to measure from the start of each repeat (`a4534b9`, "approved design change").
- **Simulator Property 22** failed: `renderFrame` threw a TypeError on `[[],[],[]]`. Fixed in `d1ad64f` (the commit message says "bug found by Property 22").
- **Simulator Property 1 generator** used `name: 42` as an invalid profile, but `parseCardProfile` only checked that `name` existed. This exposed a codec gap: new violation kind `not-a-string`, criterion R2.10, Property 84 (`f6b7e75`).
- **Simulator R10.2** (frame time) was missed by the benchmark: with float highlighting on the median was about 16 ms and the worst up to 24 ms at 1920 x 1080. Not a property failure; found by the benchmark test (task 4.4). The user approved a requirement change (`271caf6`) and run-length highlighting was added (`195d5ec`), giving about 10.6 ms. Source: Log 2026-11-18 (simulator phase 4).
- **Property 69** (noise images) was split because 8 of 3,000 noise images failed at a later step than expected (Log, 2026-11-18). Task 5.14 was parked (section 7).
- **Unfilled-placeholder announce bug (app).** How it was actually found: not by a property. During README media capture (task 3.6) the live message after "Accept this card" read "Card {number} added." The 3.6 log entry records it as "Seen while capturing (not changed)". It was then fixed in `59956cb` with a new regression test `tests/ui/screens/announce.test.tsx`, and the GIF was re-recorded in `5d55064`. The task 3.7 entry says: "The 3.6 entry says 'not changed'; it was fixed afterwards." The regression test includes a fast-check property (`fc.assert` in the R14.10 test: no unfilled `{placeholder}` in any announced message with placeholders, in either language) plus two examples. The log does not record the failing counterexample, because the bug was seen during capture, not found by a failing property run.
- **CardThumb R15.6 defect (app).** Found by the requirement-ID coverage task 3.9, not by a property from the design: the task wrote a failing test for R15.6 and stopped. `CardThumb` drew only a rectangle and one disc per punched hook, with no Card_Profile input. Fixed in `f352bf3`, with `tests/ui/screens/cardDrawing.test.tsx` (an example and a property). The same commit raised Property 38's `numRuns` from 20 to 100. Source: Log 2026-11-21 (task 3.9 and 4.5).
- **Archive Property 18** (test bug, mine): see section 7.

### 5a. Property and browser checks (tasks 7.1 and 7.3)

**`check:browser` step 11 flake (task 7.1, `b58a01c`).** Step 11 failed once with `the pick counter did not reach 36 of 36 within 60000 ms (values seen: none)`. It was **not reproduced**: 10 runs of the unchanged check, 10 runs of the changed check, 3 CPU-throttled runs (4, 8, 16) and 6 parallel throttled runs all passed 12 of 12 (the 7.1 log entry). The likely cause, from reading the code and not from a reproduced failure: the old wait only recorded values once it had read a pick below the total, so if one read landed on the one-render `Pick 1 of 36` and the next was already `Pick 36 of 36`, the wait could never finish. The fix is in the check, not the app: the wait now ends as soon as a read shows the last pick (`stepPickWatch` in `scripts/checks/pickWatch.ts`). Timeouts and assertions are unchanged, and the failure message now carries more state. A hidden or background tab was not tried. The app shows `Pick 1 of 36` for one render before it seeks to the end (observed with a `MutationObserver`); I did not judge whether that flicker needs its own fix, and nothing was changed in the app.

**The flicker was fixed in task 8.3** (`ad26a4b`). The failing test was written and run first; it showed two stale renders per arrival, not one (`expected [ 'Pick 0 of 0' ] to deeply equal [ 'Pick 36 of 36' ]`), because the cloth was also built in an effect. The fix builds the cloth in the render that first shows it and derives the shown position from one value in the pure layer (`displayedPlayback` in `src/ui/state/playback.ts`), which is the same state the player's seek enters, so the counter and the player cannot disagree. A `MutationObserver` over 11 arrivals recorded **two counter values on 11 of 11 arrivals of the unfixed build and on 0 of 11 of the fixed build**; the property is at seed 80301, 200 runs. One behaviour changed on purpose: when a rebuild fails and the previous cloth stays on screen (R2.12), the counter now keeps the position of the cloth on screen. The three `check:browser` steps that read the counter poll it, so they could not see the one-render value and cannot show the change.

**`check:browser` step 13, network off (task 7.3, `7e8de62`). Finding, open, not fixed.** One real run: 12 passed, 1 failed.
- A (offline, then reload): fails. The site has no service worker, so a reload with no network lands on Chrome's error page (`ERR_INTERNET_DISCONNECTED`); the other four A checks did not run.
- B (online load, then offline, no reload): Try it play to 36 of 36 and the 1-bit BMP export pass. The Scan read fails with a timeout, because the Scan screen is a lazy chunk (R16.10) that was not fetched before the network went off. A Scan read after the chunk had been loaded once was not tested.

This is a tension between R13.1 and R16.10 plus a missing service worker. Nothing was changed. The options named in the 7.3 log are a service worker that caches `dist/`, prefetching the Scan chunk after first load, or amending R13.1.

**Closed in task 8.1** by the first of those options: a hand-written service worker with a build-time precache list, the amendments to R13.1 and R16.10, and Requirement 24. Step 13 was rebuilt (it now stops the preview server, so the network is really gone) and passes: 13 of 13 steps, with the offline reload, the first Scan open and a BMP export all served from the cache. The two paragraphs above describe the run of task 7.3 and the repository as it was then.

**What the service worker is, and where it runs.** `public/sw.js`, hand-written plain JavaScript, no new dependency (`dependencies` are still `react` and `react-dom`, which `tests/ui/structure.test.ts` checks). 13 precache entries, generated after the build by `scripts/build_precache.ts` so hashed names are never written by hand; the cache name carries a hash of every precached file (`naqsha-v1-be994549d044` for the build of task 8.5), and `activate` deletes every cache that is not the current one. It is registered only in the built site, never by the dev server. Update path: the app tells the visitor a newer version is ready and reloads once when they ask for it; nothing reloads unasked. Four properties cover it with fakes for `Cache`, `CacheStorage` and `fetch` (seeds 2401 to 2404, 200 runs each). Two faults were found only by real runs and no fake could have found either: `vite preview` sends `Vary: Origin` while the page asks for its chunks with `crossorigin`, so `cache.match` missed everything until the lookup passed `{ignoreVary: true}`; and Chrome's offline emulation does not reach the worker's own requests, so the first "offline" run was answered by the still-running preview server. **Unverified:** the offline evidence is from the local built site under `vite preview` in a real Chrome. The deployed site at https://naqsha-ashen.vercel.app/ is an older Vercel build: its asset hashes differ from the local build and `GET /sw.js`, `/manifest.webmanifest` and `/icons/icon-192.png` all answer 404 there (checked in task 8.5), so offline support and installability are live only after the next deploy. Installing the app on a real phone, and any browser install prompt, were never tried.

### 5b. Custom agent: `weave-reviewer` (task 7.4, `3f62508`)

`.kiro/agents/weave-reviewer.md`, in the Markdown format with YAML front matter that https://kiro.dev/docs/custom-agents/configuration-reference/ describes (the 7.4 log says it fetched that page). Tools `read` and `shell`, shell limited to `git diff`, `git log`, `git show`, `git status`, `grep` and `rg`, writes denied, resources the glossary, `card-geometry.md` and `testing.md`. It checks three things in a diff: weaving terms (A), hard-coded card layout values (B), and exported functions with no fast-check property that names them (C).

**The agent itself was NOT run.** A sub-agent cannot start a custom agent, and the session could not open the Kiro chat to select it. Its checklist was executed by hand by a sub-agent (with `git`, `grep` and throwaway scripts in `/tmp`, not committed) on `a9830f0..HEAD` over `src`, `scripts` and `tests`: 136 files, 17,215 added lines. Whether the agent loads and follows its own file in the IDE is unverified. The review is in `docs/WEAVE_REVIEW.md`. The counts there:

| Check | Real | Acceptable | False positive |
|---|---|---|---|
| A. Weaving terms (242 lines) | 7 | 155 | 80 |
| B. Hard-coded layout (23 entries) | 7 | 13 | 3 |
| C. Exported functions without a property naming them | 1 of 33 (`downloadBmp`) | | |

C: 32 of 33 functions are named in a test that calls `fc.assert`. `downloadBmp` is not, and `tests/structure/propertyNames.test.ts` hides this because `downloadBmp` is in its `EXCLUDED_FROM_COVERAGE` list. The same list also holds `paintToCanvas` and `browserScheduler`, which now have property tests. The classification into real, acceptable and false positive is the sub-agent's judgement, and the searches only cover the listed words and numbers. **None of the real findings were fixed in task 7.4.**

**All of them were fixed in task 8.2** (`157500a`, `4382f86`), and the review's own numbers moved: one entry was reclassified from false positive to acceptable (`src/ui/samples/sampleDesigns.ts`, "cells" for a motif tile, which is part of the naksha), giving A 7 real / 158 acceptable / 77 false positives; B stayed 7 / 13 / 3. The 7 + 7 + 1 real findings were fixed, plus the `endOrder` finding in `check:browser` step 10 (and the review's reading of that one was corrected: the formula indexed document order, not ends, so the step was right for the row-major demo profile while checking no end at all).

**The automated checks then found nine more real findings than the review did.** `tests/structure/glossaryTerms.test.ts` scans the identifiers and comments of `src` and `scripts` for the review's word list and reported 105 uses on its first run; **nine were real and were fixed** (`cell`/`cellRange`/`firstRow` for an end index and a hook range in `src/codec/validateCardProfile.ts`; `cell` indexing ends in `src/simulator/render.ts`; `weftByRow`, `shedRow`, `weftRow`, `warpMaskRow` and `row` for a pick there; `row` for a `PickRow` in `src/simulator/floats.ts`; and comment terms in `src/simulator/style.ts`, `src/codec/types.ts`, `src/reader/sampling.ts`, `src/ui/printable/layout.ts`, `src/ui/samples/sampleDesigns.ts`, `src/ui/screens/keep/KeepScreen.tsx` and `scripts/checks/summary.ts`). None was in the review's 242 lines, because the review read only the lines the app spec added and these are older code. Every edit is a local name or a comment, so no behaviour changed. The remaining uses are covered by 16 allowances, each carrying a reason, and a test fails if an allowance covers nothing.

The other two checks of task 8.2: `tests/structure/cardDimensions.test.ts` derives the demo profile's numbers and reports literals in `src` and `scripts` that hold one as card geometry, in three tiers (it reports four literals today, all explained by three line-scoped allowances: `DEFAULT_PIXELS_PER_MM = 12`, the deliberate demo pin in `check_browser.ts`, and `ICON_SIZES = [192, 512]`). `tests/structure/propertyNames.test.ts` was strengthened to the rule the review used by hand: the function name must stand inside the same `it(...)` as the property runner, or in a helper that test names, and not after a dot. `paintToCanvas`, `browserScheduler` and `downloadBmp` left `EXCLUDED_FROM_COVERAGE`; **only `loadPixelData` remains, with its reason** (the browser boundary, no pure rule to state). The strict rule reported `decidePunched` (`src/reader/sampling.ts`) as having no property, so **a property was written for it** (seed 80219, 300 runs) instead of an exclusion. Both checks have unit tests that plant the review's real findings and watch them be flagged, and both state what they cannot find: a synonym outside the word list, an inflected form, text inside a string literal (which is why one of the seven category A findings, a test title, is invisible) and the whole `tests/` tree for A; a number written in another form such as `6 * 32` for B; and for C, whether a property says anything worth saying about the function it names.

## 6. Vibe sessions

No evidence in the repository. BUILD_LOG lists vibe only as an option in its entry template, and no entry names a vibe session. Every recorded session was run from a spec or an ad hoc request described in the log.

## 7. What did not work

All from `docs/BUILD_LOG.md` unless a hash is given.

- **Task 5.14 parked.** Four image properties (67, 68, 70, 77) failed on small or sparse cards because the layout check rejects good reads. These were safe failures (no wrong grids). They are saved as `.kiro/specs/card-codec-and-reader/parked-5.14-readCard-tests.patch` and folded into defect task 5.18, which the log says is still open. Commits `36b3f51`, `3963367`.
- **Property 18 of the archive, my test bug.** `tests/archive/designs.test.ts` first expected only `storage-unavailable` or `write-failed`, but a `get` or `delete` of an unknown id on an empty store correctly returns `not-found`. The fix lets `not-found` through for those two calls on an empty store. The original failing counterexample could not be recovered, so the log describes the cause from the final test text. The log says this loosens the property and needs the user's confirmation. The test is in `9486b0c`; no separate fix commit exists in git history.
- **Exporter size-limit test**: first used a layout too small to exceed 2 GB (arithmetic error in the test). It now checks `bmpLayout` only.
- **Exporter `download.ts` import test**: could not run in-process because Vitest itself needs `URL`; it runs in a child Node process.
- **The floral sample (and the other two samples).** The first diamond, border and floral designs looked stretched on square-thread cloth. Commit `de65145` retuned them. The log says "I did not record the shapes before the retune", and eyes-on judgement of the three shapes "is still the user's".
- **A timing that could not be reproduced.** 74.3 ms per frame during simulator task 2.4; repeated runs gave 5.5 to 6.7 ms. Cause unknown. Isolated worst frames of 29 ms and 147 ms were also not investigated.
- **`src/archive` stub files deleted** from the working tree during phase 3 of the first spec, cause unknown; restored from git.
- **Shell limitation:** the shell refused heredocs containing "npm run" text, so some files were written in pieces.
- **task_update tool failures:** no evidence in the repository. The build log does not record any.
- **Fixtures and real photos.** All reader tests and fixtures are generated images (`scripts/make_fixtures.ts`, seeded). No real photograph of a card has been read. `scripts/photo-trial/` is a dev-only printable card and `scripts/read-photo.html`; no result of a real-photo trial is recorded. The `ambiguous-orientation`, `resolution-too-low` and `card-outside-image` failures were checked only on synthetic images.
- **Hooks:** the fixtures hook has still never been seen firing; the related-tests hook now has 68 log lines, all `exit 0` or `exit 1`, of unproven origin, and its 10 s timeout was killing every save of a codec file until task 8.4 measured the real cost (section 3). **Context7 used once, with no detail** (section 4).
- **Step 11 flake:** one failure, never reproduced; the cause is a reading, not a proof (section 5a). The one-render counter value it pointed at was fixed in task 8.3.
- **Offline:** fixed in task 8.1 and passing locally in a real Chrome, **but not deployed**: the live site is an older Vercel build with no `sw.js` (section 5a).
- **Custom agent `weave-reviewer` and the `prerelease-check` command were never run in the IDE** (sections 2 and 5b), so neither has been seen working where it is meant to work. Its checklist, run by hand, produced findings that were all fixed in task 8.2, and the automated version of check A then found nine more (section 5b).
- **Missing `KIRO_PROMPTS.md`:** prompts 38 and 39 could not be read, so the agent and command follow the user's descriptions.
- **Dropped or left out:** Hindi voice prompts (R19) and the Night loom theme (R20.5) were dropped by the user; hole pop (R20.1) and thread-drawn progress (R20.3) were left out in the trim. The Night tokens exist but nothing switches to them.
- **Open accessibility gap:** after the rise-from-darkness skip control is used, it disappears and keyboard focus falls back to the page. Not fixed; the test setup has no DOM.
- **A requirement-ID mismatch:** four existing test titles carry IDs that do not match the criterion of that number (Log, task 3.9). Left unchanged.
- **README out of date** at the time of the task 3.9 and 4.5 entries; the later commit `1d24fbc` ("Update README status and quick start to match the built app") addresses it. I did not check the current README against the app.

**Unverified, per the log:** real IndexedDB in a browser (tests use a hand-written fake); the live camera on a real phone (fake camera only); printing at 100% scale; a camera photo of a printed card; that the agent and the steering command work in the IDE; any loom controller (no exported BMP has been tried); on-device timings (all numbers are from a laptop, Node v24.5.0, Apple M1); the real card dimensions (the demo profile is illustrative); all 178 Hindi strings (`reviewed: false`); the rise-from-darkness look and reduced-motion behaviour; that the README GIFs play on GitHub.

## Checks run for this file

First written after `npm run test:run` (91 files, 730 tests), `npm run typecheck`, `npm run build` and `npm run check-bundle` (entry chunk 93,203 bytes gzipped, limit 204,800) all passed, with `npm run check:hooks` output in section 3.

Updated in task 8.5 after these real runs, all passing: `npm run test:run` (**97 files, 804 tests**), `npm run typecheck`, `npm run build` (`precache: 13 entries in cache naqsha-v1-be994549d044`), `npm run check-bundle` (**entry chunk 94,191 bytes gzipped, limit 204,800**), `npm run check:all` (9 PASS, 0 FAIL, 1 SKIPPED because the repo has no spec format validator command, 1 INFO about the dirty working tree), `npm run check:browser` (13 of 13 steps), `npm run check:deployed` (4 of 4, against the older deployed build) and `npm run check:hooks` (output in section 3). Full output in `docs/BUILD_LOG.md`, task 8.5.
