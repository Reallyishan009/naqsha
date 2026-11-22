# Part B: Judges' demo kit: working brief

Branch auto/build. Part A (home button) is done: 7688786. CREDIT CAP for the whole of Part B: under about 100 credits; after about 85 stop, write what is left in docs/STUCK.md and report. No new dependencies, colours or fonts. Reuse run 1/2 components (Card, Chip, Button, Disclosure, SectionHeader, Photo, PhotoCaption...). Never loosen a check; change a limit only with the number logged in `.kiro/specs/judges-kit/measurements.md` (create it: sections Changed checks, Bytes, Real card reads, Not checked by eye, Skipped). Only one sub-agent task at a time. Commit and push (plain `git push origin auto/build`) after each screen. No new property tests. Glossary naming. Hindi strings: en.json + hi.json (hi reviewed:false), ADDED_KEYS in tests/ui/state/stateMessages.test.ts, npm run review-list. Keep every existing accessible name/test id. Entry chunk stays under 150,000 B gzipped. Work efficiently; short reports; look at your own screenshots at most once or twice (the orchestrator opens them too).

The untracked public/demo/ folder is the user's, not a stray: public/demo/cards/ (7 PNGs we made with our own code: card-1-clean, card-2-clean, card-3-clean, card-1-tilted, card-1-noisy, card-1-noisy-tilted, card-blank-should-fail), public/demo/loom-files/ (diamond-1bit.bmp, diamond-8bit.bmp: the app's own BMP export), public/demo/real-cards/ (8 JPEGs of real Jacquard cards from Wikimedia Commons plus CREDITS.md), public/demo/README.txt.

GOAL: a judge with no punched card can test every function on every screen with one click, and can download a loom file.

## 1 SCAN: a "Demo cards" Card beside the drop zone (below it at narrow widths)
a. Group "Demo cards": the 6 readable PNGs as small thumbnails named "Clean 1", "Clean 2", "Clean 3", "Tilted", "Noisy", "Noisy and tilted", and the 7th as "No card (should fail)". Pressing one loads that image into the normal Scan flow exactly as an uploaded photo would (same code path as the file input: fetch the image, make a File/Blob, same sweep, same tap-to-fix, same error message for the blank one). Each thumbnail has a download link for the original PNG. One-line note: "Made by us with the demo card layout. Not a real loom's card."
b. Group "Real card photos": thumbnails from public/demo/real-cards/ (the 4 single cards, the chain, the two Bradford photos, the sari cards: 8 files). Group label: "Real photos. Naqsha's reader is built for the demo card layout, so it may not read these correctly." Pressing one loads it into the normal Scan flow. Do not hide or fake a result: show exactly what the reader returns, including a failure message or a wrong read. Show author and licence from public/demo/real-cards/CREDITS.md in a caption under each thumbnail (parse the markdown at build time like src/ui/state/imageCredits.ts does for docs/IMAGE_CREDITS.md, with a test that every file in the folder has an entry). These files (1.1 MB) are NOT precached; offline they show a plain "needs a connection" message (a fetch failure while offline gives that message, not a scan error).

## 2 KEEP: a "Demo" Card
"Save a demo design" (saves the Diamond sample with a demo name and weaver and place fields filled in), "Make a demo edit" (changes a few cells and saves a new version so version history and compare have something to show), and "Download loom file" with two links: diamond-1bit.bmp and diamond-8bit.bmp from public/demo/loom-files/. The normal export buttons stay and must still produce the same bytes.

## 3 CODE: a "Demo" Card
"Load the Diamond card as code", "Add a breakpoint on pick 3" and "Compare with an edited version", each using existing state actions.

## 4 WEAVE: a "Demo" strip
The three samples (already there) plus "Show a lost card" and "Show a torn card", which load Diamond with one card flagged so the repair suggestions can be seen. Use existing repair state and flags only (lost = gap flagged missing; torn = gap flagged damaged: check the existing gap/flag types).

## 5 All Demo Cards
Each has a small "Demo" Chip, is keyboard reachable, has 44 px targets (48 preferred), English and Hindi strings (Hindi unreviewed), and works offline. Precache the five small demo cards (clean x3, tilted, blank), the two BMPs and the README only. Keep the two noisy PNGs (about 253 KB together) out of the precache if the precache total would pass its limit (find the limit in scripts/check_bundle.ts / tests; if there is none, state that and decide with the number); log the number and the choice. The real-cards folder is NEVER precached. scripts/build_precache.ts currently lists every file of dist/: add an explicit, tested exclusion list (e.g. NOT_PRECACHED_PREFIXES) and re-aim tests/scripts/precache.test.ts R9.5 ('every built file is named') to allow exactly that explicit list and to assert the excluded files are NOT in the list; log it.

## 6 docs/JUDGES.md
A 10-step test path (one line per function: which button, what to expect), plain English, no marketing. Link it from the README. Add the plain line: "No real loom's own file format was available to us. The BMP is Naqsha's export and is not tested on a physical loom."

## 7 Tests
Unit/component tests for each new action. check:browser: open Scan, press "Noisy and tilted", the read grid equals tests/fixtures/pick0-noisy-tilted.json; press the blank card and see the not-found message; Keep "Download loom file" returns a valid BMP header 192 wide (fetch the link href and parse the BMP header: 'BM', width 192).

## 8 Screenshots
All four screens with the Demo Cards at 390 and 1280, day, in media/design/after-run3/ (names scan-demo-day-390.png, keep-demo-day-390.png, code-demo-day-390.png, weave-demo-day-390.png and the same for 1280). Add them to scripts/screenshots.ts as a mode `after-run3` with a validator and tests like the earlier modes. The orchestrator opens them.
