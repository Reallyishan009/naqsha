# Measurements: lang-and-scroll

- Entry chunk: 131,325 bytes gzipped (limit 150,000). Scan chunk 11,716 bytes gzipped.
- Gate: typecheck, test:run (2179 passed), build, check-bundle, check:browser (26 passed), contrast report: all green.
- Re-aims: none. No assertion was loosened. `initialAppState.language` stays `hi`, so `appState.test.ts` is unchanged; the runtime choice is `chooseLanguage(readStoredLanguage(store), browserLanguage())` in App.tsx.
- check:browser step 1 (first screen heading) already accepted either language, so it needed no change.
- New tests: `chooseLanguage` and `browserLanguage` (tests/ui/platform/browser.test.ts); `scrollResultIntoView` (tests/ui/screens/scan.test.tsx).
- New check:browser step 23: at 390 px the read result top is within the viewport after pressing the "Noisy and tilted" demo card.
