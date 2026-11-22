# Stuck: decisions needed from the user

## 2026-11-22: default language (app R12.2), not changed

**Request.** On a first visit, choose `hi` only if `navigator.languages` has an entry starting with "hi", otherwise `en`. A stored `naqsha.language` always wins. The function never throws. It is a pure function in `src/ui/platform/browser.ts` next to `readStoredLanguage`. It comes with tests and a `check:browser` step with Accept-Language `en-US`.

**Why it is stopped.** The request contradicts an approved requirement.

- `.kiro/specs/app/requirements.md` line 238, app R12.2: "WHEN the App starts without a stored language choice, THE App SHALL use Hindi." Its user story (line 232): "I want the app in Hindi by default and English on request".
- `.kiro/specs/app/design.md` line 126: "Hindi is the default".
- `.kiro/specs/app/tasks.md` line 64: `initialAppState` has language `hi`.

**State.** No code was changed. `src/ui/App.tsx` still falls back to `initialAppState.language` (`hi`) when nothing is stored.

**Decision needed.** Change R12.2 and the design to "Hindi when the browser prefers Hindi, otherwise English", then implement the request above. Until then the default stays Hindi.

Resolved: the default language decision was made (R12.2 changed). `chooseLanguage` and `browserLanguage` in `src/ui/platform/browser.ts` are implemented and wired in `src/ui/App.tsx`.
