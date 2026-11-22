# Implementation Plan: three small fixes

## Overview

Three small fixes. Credit target under 20, stop after about 18. Commit each fix separately and push to auto/build (plain push, explicit paths). The orchestrator already checked Fix 1's precondition: app spec Requirement 12.2 says "WHEN the App starts without a stored language choice, THE App SHALL use Hindi." (.kiro/specs/app/requirements.md line 238; user story: "I want the app in Hindi by default and English on request"); also app/design.md line 126 ("Hindi is the default") and app/tasks.md (`initialAppState` language `hi`). So Fix 1 is STOPPED: the default is NOT changed.

## Tasks

- [x] 1. Fixes 1 and 2
  - [x] 1.1 Fix 1 note in docs/STUCK.md, then Fix 2 security headers
    - Fix 1 (stopped): create docs/STUCK.md (or append) with a dated entry: the requirement id "app R12.2", its exact wording, the two other places (app design.md line 126; app tasks.md initialAppState), what the user asked (first visit chooses 'hi' only if navigator.languages has an entry starting with "hi", else 'en'; stored 'naqsha.language' always wins; never throws; pure function in src/ui/platform/browser.ts next to readStoredLanguage; tests; a check:browser step with Accept-Language en-US), that no code was changed, and the decision needed from the user (change R12.2 and the design to 'Hindi when the browser prefers Hindi, else English', then implement). Commit this alone: message `docs: default language needs a decision (R12.2), not changed`; push.
    - Fix 2: vercel.json has no headers. Add a "headers" entry for all paths ("source": "/(.*)") with: X-Content-Type-Options: nosniff; X-Frame-Options: DENY; Referrer-Policy: no-referrer; Permissions-Policy: camera=(self), microphone=(), geolocation=(); Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'. FIRST check what the built app really needs: inline styles (style attributes / React inline styles / the SVG), blob: images and blob: downloads (camera frames, downloads, createObjectURL: downloads via an anchor with a blob: URL are not governed by connect-src/img-src but check), the service worker (worker-src 'self', its fetches), the demo image fetch from public/demo (connect-src 'self'), the inline theme script in index.html (dist/index.html has an INLINE classic script placed before the module script to set data-theme before first paint: script-src 'self' would BLOCK it! Resolve this without weakening: either move it to an external file in public/ (e.g. /theme-init.js, precached, loaded as a classic blocking script before the stylesheet; update scripts/check_bundle.ts themeScriptProblems, tests/ui/theme/theme.test.ts which runs the script from index.html in node:vm, and the precache) or allow its sha256 hash in script-src (compute at build time: fragile). Prefer the external file and keep the same behaviour and tests at the same strength; log it), media: camera via getUserMedia is governed by Permissions-Policy camera=(self), not CSP. If you must allow anything beyond the given CSP, say what and why in .kiro/specs/three-fixes/measurements.md (create it) and keep it as narrow as possible. Tests: a deploy test that vercel.json is valid JSON and has these header names with these values (exact strings for the simple ones; the CSP parsed into directives and compared with the final policy; assert no directive allows a host other than 'self'/data:/blob:/'unsafe-inline' for style-src only). check:browser must still pass 100% with the policy applied: make the check's preview server send exactly the headers from vercel.json (read vercel.json; Vite preview `preview.headers` in vite.config.ts or the check server) and have a check:browser step that fails if the browser reports any Content-Security-Policy violation (listen for Log.entryAdded/Runtime console 'Refused to' messages and the securitypolicyviolation event) across all four screens, a sample, the Landing, a download and offline; if the preview server cannot send headers, say plainly that CSP was not exercised in the browser. Do not weaken the existing rule that the site makes no third-party request. Gate: typecheck, test:run, build, check-bundle, check:browser, contrast report. Commit `deploy: security headers and CSP` and push. Report: Fix 1 note commit hash, Fix 2 commit hash, the final CSP string, what you had to change for it (theme script etc.), whether the browser exercised the CSP, gate results, entry chunk bytes. Credit target about 15, be very efficient.

## Notes

- Fix 3 (commit every uncommitted file under .kiro/) is done by the orchestrator afterwards.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] }
  ]
}
```
