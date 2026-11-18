# Naqsha

Naqsha is a browser app for handloom weavers, card makers (naqshband) and textile archivists. The camera reads a Jacquard loom punch card, the app rebuilds the weave pattern, simulates the cloth pick by pick, and exports a bitmap for electronic Jacquard looms. Everything runs in the browser, with no backend for core features.

**Status:** project scaffold only. No features are built yet.

## Demo profile values are illustrative

The card layout is a profile loaded at runtime. The only profile in the repo, `public/profiles/demo-12x16.json`, holds ILLUSTRATIVE, UNVERIFIED values for a small demo card (12 hook rows x 16 hook columns). No real card has been measured. Replace these values with measured ones before relying on them.

## Run it

Requires Node 22.18 or newer.

```
npm install
npm run dev          # start the dev server
npm run test:run     # run the tests once (npm test watches)
npm run typecheck    # type-check with tsc
npm run build        # type-check, then build to dist/
npm run fixtures     # regenerate the synthetic card images in tests/fixtures/
```

## Project docs

Product, tech, structure, glossary, card geometry and testing rules are in `.kiro/steering/`.

## License

MIT. See `LICENSE`.
