# Judges' demo kit: measurements

## Changed checks

- `tests/ui/illustrations/illustrations.test.tsx` R14.7 ("added no image or font file for an illustration"): the filter of added files now also skips `public/demo/` (it already skipped `public/fonts/`). Everything else under `src` and `public` stays strict, and the package.json dependency comparison is unchanged. Reason: public/demo/ holds test images and BMPs, not illustrations.
- `tests/scripts/precache.test.ts` R9.5: was "omits no file of the built site"; now "omits no file except the explicit NOT_PRECACHED list". Added a test that every excluded file is absent from the list and the small demo files are present, and a unit test of the list and of the cache name (an excluded file does not change it).
- Mechanism: `scripts/checks/precache.ts` exports `NOT_PRECACHED_PREFIXES = ['demo/real-cards/']`, `NOT_PRECACHED_FILES = [demo/cards/card-1-noisy.png, demo/cards/card-1-noisy-tilted.png]` and `isNotPrecached(path)` (those two plus `sw.js`). `precacheEntries`, `precacheCacheName` and `precacheProblems` use it, so `build_precache.ts` and `check_bundle.ts` agree.

## Bytes

Precache total = sum of the bytes of every listed file (sw.js excluded; "./" is index.html).

| State | Files | Bytes |
|---|---|---|
| Before (no demo files) | 45 | 1,344,461 |
| After (5 small cards, 2 BMPs, README) | 53 + "./" = 54 entries | 1,397,783 (+53,322) |
| If the two noisy PNGs were added | 56 entries | 1,651,321 (+253,538, +18.9%) |
| Not precached: real-cards (8 JPEGs + CREDITS.md) | 9 | 1,106,197 (jpgs and md) |

- There is no precache size limit anywhere (scripts/check_bundle.ts only limits the entry chunk: 200 KB, and 150,000 B gzipped for the Landing). Decision with the number: the two noisy cards stay out. They are 253,538 B (126,597 + 126,941), 4.7 times the other demo files together (53,322 B), and every first visit would download them for a test-only feature. Offline, the noisy cards load only if the browser already has them.
- Entry chunk: 128,144 B gzipped (limit 150,000).

## Real card reads

Run with `node scripts/real_card_reads.ts` (headless Chrome, the built app at 1280 px, English): each real photo is pressed on Scan, so the real `loadPixelData` and `readCard` run, with the reader unchanged. Each result is the message the screen showed.

| File | Reader returned |
|---|---|
| real-card-single-1-cc0.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-single-2-cc0.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-single-3-cc0.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-single-4-cc0.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-chain-cc0.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-bradford-chain-ccby.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-bradford-stack-ccby.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |
| real-card-sari-pattern-ccby.jpg | failed: `peg-holes-not-found`, "The two large alignment holes were not found. Place the whole card in the photo on a plain background and try again." |

None was read or partly read. All eight fail at the same step (the two large alignment holes of the demo card layout are not in a real card), which is what the screen says. The screen shows the message as it is and offers no result.

## Not checked by eye

- Task 2.1: the Scan screen's Demo cards layout (beside the drop zone at 1280 px, below it at 390 px) and the thumbnail look were not looked at; the after-run3 screenshots of task 4.1 cover them.
- Offline, the thumbnails of the two noisy cards and of the real photos show as broken images (they are not precached); pressing them shows the "needs a connection" message. check:browser step 21 still passes (it accepts failed requests for files that are not precached).

## Changed checks (task 2.1)

- `tests/ui/deploy.test.ts` R13.3 ("the only fetch in src/ui is the Card_Profile request"): now expects exactly two calls, `ui/App.tsx: profileUrl()` and `ui/platform/browser.ts: demoImageUrl)` (a GET of a demo image served with the app; nothing of the user's is sent). The call sits in `src/ui/platform/browser.ts` so the R13.1 check on the Scan screen sources (no network call in ScanScreen.tsx, CardOverlay.tsx, BatchList.tsx, scan.ts) stays unchanged and passes.
- `tests/ui/deploy.test.ts` R23.7 (no third-party URL in the production build): the allowed links now also include exactly the addresses written in `public/demo/real-cards/CREDITS.md`, because that file is bundled whole to read the authors and licences (as docs/IMAGE_CREDITS.md already is). No other address is allowed.
- `tests/ui/accessibility.test.tsx` is unchanged: each demo thumbnail image has the name of the card as its alt text.

## Bytes (task 2.1)

- Entry chunk: see the report of task 2.1 (limit 150,000 B gzipped).

## Keep demo card (task 3.1)

- Changed check: `scripts/check_browser.ts` step 21 (works with the network off) now also fetches `demo/loom-files/diamond-1bit.bmp` and `diamond-8bit.bmp` while offline and requires 'BM' and width 192. Nothing loosened.
- Loom files vs the app's export: the two committed BMPs are 192 x 200 and are byte-identical to the app's export (`exportPatternBmp`, default options, through `runExport`) of `demoPattern(profile, 200)` (the diagonal pattern of `scripts/export_sample.ts`), not of the Diamond sample. The Diamond sample has 36 picks (926 B at 1 bit, 7,990 B at 8 bit against 4,862 B and 39,478 B), so the files are not byte-identical to a Diamond export. Files not altered. Same width (192). The links keep the names `diamond-*.bmp` as the brief says; the card text does not claim the files are the Diamond sample. Tested in `tests/ui/state/demoDesigns.test.tsx`.
- Entry chunk after 3.1: 130,137 B gzipped by `check-bundle` (limit 150,000).
- Demo name, weaver and place of the saved demo design are fixed English words (data of the saved design, not screen text), so the design can be found again in either language.

## Code demo card (task 3.2)

- Changed check: `tests/ui/screens/code.test.tsx` R11.1 (Tab order of the Code view). The expected list is still an exact `toEqual`; it now starts with the two enabled buttons of the new Demo card ("Load the Diamond card as code", "Compare with an edited version"), which sit between the diff panel and the pick controls. The breakpoint button of the card is disabled for the 3-pick design of that test (it needs 4 picks), so it is no tab stop there. Nothing removed from the list.
- Pick numbering: the Code view counts picks from 0 (R2.2 of cards-as-code: "pick number is the pick index counted from 0"; the jump range reads "0 to last"). "Add a breakpoint on pick 3" sets the breakpoint the screen labels "Breakpoint on pick 3", the fourth card. It needs a design of at least 4 picks and says so when it has fewer; pressing it twice keeps the breakpoint (it never removes one).
- "Compare with an edited version" saves nothing but the demo design and its edit(s) through the Keep demo functions (`saveDemoEdit`), then compares the oldest and the newest version of the demo design through the existing `compare-versions` state. The diff panel is drawn again (a new key) so its list holds them. Pressing it again saves nothing more.
- "Load the Diamond card as code" uses `request-sample`, so unsaved scanned cards raise the usual question; the question is drawn on Weave, so in that one case the screen goes to Weave.
- Entry chunk after 3.2: 130,955 B gzipped by `check-bundle` (limit 150,000).

## Weave demo strip (task 3.3)

- No check changed. "Show a lost card" loads the Diamond with pick index 4 (the first lost-card pick of the existing sample) as a `missing` gap (the slot is null); "Show a torn card" loads it with the same pick as a `damaged` gap (the card with its last hook row torn off, so it is no card of the profile). Both go through the existing `request-sample`, so unsaved scanned cards raise the usual question. Exactly one pick is flagged in each; the simulator's gap report and the repair module read the kind asked for, and the first suggestion is the original Diamond card (tests in `tests/ui/samples/sampleDesigns.test.ts`).
- The three samples and "Try a design with lost cards" (three gaps) are unchanged.
- Entry chunk after 3.3: 131,375 B gzipped by `check-bundle` (limit 150,000).

## Skipped
