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

(filled in task 2.1)

## Not checked by eye

## Skipped
