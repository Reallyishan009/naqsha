# Font tooling

Dev-only tools that make the six Font_Files in `public/fonts/`. Nothing here is part of `npm run build`: the woff2 files and the licence texts are committed, and the build only copies them.

| File | What it does |
|---|---|
| `subset.sh` | Downloads the four static `.ttf` files, the two Newsreader variable `.ttf` files and four `OFL.txt` files, pins the Newsreader axes with `fonttools varLib.instancer` (wght 400, opsz 36), subsets the fonts with `pyftsubset`, copies the licence texts and runs `report.ts`. |
| `codepoints.ts` | Reads every string value of `en.json` and `hi.json` and the three Sample_Design names, and writes the two code point lists `subset.sh` uses. |
| `woff2Cmap.ts` | Reads which code points a woff2 (or .ttf) file covers, with `node:zlib` and no other tool. Used by `report.ts` and by the font test. |
| `report.ts` | Prints the size of each file before and after subsetting, the sum, and the code points each source font lacks. Writes `missing-glyphs.json`. |
| `missing-glyphs.json` | The code points a source font does not have (made by `report.ts`, committed). The font test allows exactly these to be absent. |

## One-time setup

`pyftsubset` comes from fontTools, and it needs `brotli` to write woff2. The environment lives outside the repository:

```sh
python3 -m venv /tmp/naqsha-fonts
. /tmp/naqsha-fonts/bin/activate
pip install fonttools brotli
```

## Make the fonts

From the repository root, with the environment active:

```sh
scripts/fonts/subset.sh
```

The script:

1. Downloads `RozhaOne-Regular.ttf`, `Hind-Regular.ttf`, `Hind-Bold.ttf`, `IBMPlexMono-Regular.ttf`, the variable `Newsreader[opsz,wght].ttf` and `Newsreader-Italic[opsz,wght].ttf` (saved as `Newsreader-VF.ttf` and `Newsreader-Italic-VF.ttf`) and the four `OFL.txt` files from `raw.githubusercontent.com/google/fonts/<commit>/ofl/{rozhaone,hind,ibmplexmono,newsreader}/` into `scripts/fonts/source/` (git-ignored). The commit is pinned as `FONTS_REF` at the top of `subset.sh`; copy it into the Build_Log (Licence record) when you change it.
2. Stops, and writes nothing, if a licence text is not the SIL Open Font License 1.1 (Requirement 2.2).
3. Runs `pyftsubset --flavor=woff2 --layout-features='*' --no-hinting` for each font. Rozha One and both Hind files get Basic Latin, the symbols found in the strings, the Devanagari block (U+0900 to U+097F), U+200C, U+200D and U+25CC. IBM Plex Mono and both Newsreader files (roman and italic, Latin headings only) get Basic Latin and the symbols only.
4. Copies the licence texts to `public/fonts/` as `RozhaOne-OFL.txt`, `Hind-OFL.txt`, `IBMPlexMono-OFL.txt` and `Newsreader-OFL.txt`.
5. Runs `node scripts/fonts/report.ts`, which prints the figures for the Font_Weight_Report and exits with 1 if the subsetting lost a code point that the source font has.

Run it again whenever a string in `en.json` or `hi.json` adds a code point that no Font_File holds yet. A code point that a source font does not have (expected: `●` and `○` of `repair.legend`) is not an error: it is listed in `missing-glyphs.json` and the browser draws it from the fallback family.
