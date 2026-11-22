# Testing Naqsha without a punched card

Open https://naqsha-ashen.vercel.app/ . No login. Every step below needs one click and no card of your own. Each Demo card on the screens carries a small "Demo" label.

## The 10 steps

1. **Weave, "Diamond"** (under Try it). Expect: a cloth weaving pick by pick, "Pick 36 of 36" at the end. "Border" and "Floral" do the same with other designs.
2. **Weave, "Show a lost card"** (under Try it, in "More" once a cloth is shown). Expect: the Diamond with one card missing and a notice "1 card could not be read". Press **Suggest repairs** to see what Naqsha guesses for it and why. "Show a torn card" does the same for a card that is there but unreadable.
3. **Weave, "Download PNG"** (printable card, under Try it). Expect: a PNG of one card of the Diamond, 720 x 540 px. You can read it back in step 4.
4. **Scan, "Clean 1"** (Demo cards, "Cards made by us"). Expect: the card is read and every hook is marked punched or not. Tap a mark to correct it, then **Accept this card**. "Clean 2", "Clean 3" and "Tilted" work the same way.
5. **Scan, "Noisy and tilted"**. Expect: the hardest of our cards (grain and a turn) is read like step 4. These two noisy images are not cached for offline use and need a connection.
6. **Scan, "No card (should fail)"**. Expect: no read and the message "The two large alignment holes were not found...". The batch and the Weave cloth stay as they were.
7. **Scan, any of the "Real card photos"** (8 photos from Wikimedia Commons, author and licence under each). Expect: **a failure**. All 8 fail with the same message as step 6 (`peg-holes-not-found`). Naqsha's reader is built for the demo card layout (two large alignment holes in a fixed place), and none of these photos has it. We show the message as it is and do not fake a read. The photos need a connection.
8. **Keep, "Save a demo design"**, then **"Make a demo edit"** (Demo design). Expect: the design in the list, then a second version of it ("2 versions"). Press **Show versions** on it to see the history, and **Compare with the previous version** to open the difference in Code view.
9. **Keep, "Download loom file"**: `diamond-1bit.bmp` and `diamond-8bit.bmp`. Expect: a BMP, 192 pixels wide (one pixel per end) and 200 rows (one per pick), 1 bit and 8 bits per pixel. These two files are byte-identical to what Naqsha exports for the 200-pick demo pattern of `scripts/export_sample.ts`. They are **not** an export of the 36-pick Diamond sample, although the files are called `diamond-*.bmp`. For the Diamond sample's own file, play it on Weave and press **Download the file for a loom** on Keep.
10. **Code, "Load the Diamond card as code"**, then **"Add a breakpoint on pick 3"**, then **"Compare with an edited version"**. Expect: one line of bits for each pick, a breakpoint labelled "Breakpoint on pick 3" (the Code view counts picks from 0, so that is the fourth card), and a list of the changed holes between the Diamond and its edited version.

Also: the **EN | हि** switch in the header changes the language. The Hindi text has not been reviewed by a Hindi speaker (`docs/HINDI_REVIEW.md`).

## What this does not show

- No real loom's own file format was available to us. The BMP is Naqsha's export and is not tested on a physical loom.
- No real card has been read. The card layout (12 x 16 hooks, two peg holes) is illustrative and not measured from a real card; see step 7.
- The live camera has not been tried on real devices.

## Offline

After the first visit the app works with the network off, including the five small demo cards and both loom files. The two noisy cards and the real photos are not cached and show "This image needs a connection" when you are offline.

The demo files are in `public/demo/` (see `public/demo/README.txt` and `public/demo/real-cards/CREDITS.md`).
