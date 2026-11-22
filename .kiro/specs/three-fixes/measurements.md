# Fix 2: security headers and CSP, measurements

## Final policy

`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`

This is the policy given in the task. Nothing was added beyond it. The other headers are `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.

## What the built app needed

- **Inline script (changed).** `index.html` had an inline classic script that sets `data-theme` before the first paint. `script-src 'self'` blocks it. It moved, byte for byte in logic, to `public/theme-init.js`, loaded by `<script src="./theme-init.js">` in the head, still before the module script and the stylesheet link. The file is copied to `dist/` and the precache list picks it up (it is in `dist/sw.js`), so it also loads offline. No hash allowance was needed.
- **Re-aimed checks, same strength.**
  - `themeScriptProblems` (scripts/check_bundle.ts) now takes a reader for the script file. It still requires a classic theme script containing `naqsha.theme` and `data-theme`, and still fails when that script comes after the module script or the stylesheet link. It also fails on any inline script, which is stricter than before. Its messages say "the theme script" where they said "the inline theme script".
  - `tests/ui/theme/theme.test.ts` runs the text of `public/theme-init.js` (found through the `src` in `index.html`) in `node:vm` for the same ten environments, with the same comparison with `chooseTheme`. The ordering test and the five `themeScriptProblems` cases are kept, with two cases added (script file missing or not the theme script; inline script reported) and one new test that `index.html` has no inline script.
- **Inline styles.** The app sets styles from React (`style={...}`), which goes through the CSSOM and is not governed by `style-src`. As a trial, `check:browser` was also run with `'unsafe-inline'` removed from `style-src`: all 24 steps passed with no violation. `'unsafe-inline'` is kept because the task's policy lists it. It can be dropped later; this run is the evidence. The live camera view (`getUserMedia`) was not exercised by `check:browser`, and its styles are React `style` props too.
- **blob: and data:.** `img-src` needs `blob:` and `data:` (camera frames, picked images, canvas output). Downloads through an anchor with a blob URL passed (steps 8, 9, 22).
- **Service worker.** `worker-src 'self'`, and its fetches under `connect-src 'self'`: install, precache and the offline reload passed (step 23).
- **Demo images.** Fetched from `public/demo` on the same origin: passed (steps 21, 22).
- **Camera.** Governed by `Permissions-Policy: camera=(self)`, not by the CSP.
- **Third parties.** None added. Step 15 (own origin only) still passes.

## Does the browser exercise the CSP?

Yes. The preview server of `check:browser` (`startPreview` in scripts/checks/session.ts) sends exactly the headers of `vercel.json`. The new step 24 fails when the browser reports a violation (the `securitypolicyviolation` event through a `Runtime` binding, and any "Refused to" or "Content Security Policy" message in the console or log) over the whole run: all four screens, the samples, the Landing, the downloads and the offline reload. It also fails when the policy the server sent differs from `vercel.json`.

Negative check: with `font-src 'none'` in `vercel.json`, step 24 failed with 144 violations (steps 1, 19 and 23 failed too). `vercel.json` was then restored.

## Gate

See the report of the task for the numbers of this run.
