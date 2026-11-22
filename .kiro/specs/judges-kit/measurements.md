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

## Skipped
