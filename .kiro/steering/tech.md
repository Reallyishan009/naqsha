# Naqsha — Technology Steering

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Bundler / dev server | Vite | Fast HMR, first-class TypeScript, easy camera API mocking |
| UI framework | React (functional components, hooks) | Component model fits the multi-step scan workflow |
| Language | TypeScript (strict mode) | Catches grid/coordinate type errors at compile time |
| Unit / integration tests | Vitest | Native ESM, shares Vite config, fast watch mode |
| Property-based tests | fast-check | Encode correctness properties for codec and simulator |
| Image processing | Plain Canvas API | No dependency, runs off-thread via OffscreenCanvas where available |
| Persistence | IndexedDB (thin wrapper, no ORM) | Survives page reload, holds binary bitmap data, no backend needed |
| Camera access | getUserMedia / ImageCapture API | Standard, no library required |

## Constraints

- **No backend for core features.** Scan, decode, simulate, export, and archive all run entirely in the browser. A future sync feature may add a backend but must not be assumed.
- **No heavy image-processing libraries** (OpenCV.js, TensorFlow.js, etc.). Hole detection uses only Canvas 2D operations and typed arrays. If a library becomes genuinely necessary, evaluate bundle size impact first.
- **No CSS framework.** Styles are CSS Modules (.module.css) co-located with their component. Utility classes are written by hand, not pulled from Tailwind or similar.
- **Strict TypeScript.** tsconfig.json must have "strict": true. Avoid any; prefer unknown with type guards.

## TypeScript Conventions

- Domain types live in one types.ts per module (e.g. src/codec/types.ts, src/simulator/types.ts).
- Prefer type aliases over interface for data shapes; use interface only when declaration merging is intentional.
- Encode impossible states out of existence with discriminated unions. Example:

```ts
type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; frame: ImageData }
  | { status: 'done'; card: PunchCard };
```

## Testing Conventions

- Every pure function in src/codec and src/simulator must have both example-based unit tests and at least one fast-check property.
- Properties to encode: round-trip (encode then decode equals identity), monotonicity (more holes produce more weft floats), boundary safety (no out-of-bounds pixel access for any input dimensions).
- Test files live in tests/ and mirror src/ (e.g. tests/codec/decoder.test.ts).
- Use vi.mock sparingly; prefer dependency injection for testability.
- Camera and IndexedDB interactions must be tested with fakes, not mocks.

## Performance Budget

- Initial page load (cold, no cache): under 200 KB JS gzipped.
- Hole detection on a 1080p frame: under 300 ms on a mid-range 2020 smartphone.
- Cloth simulation (100-row pattern): under 16 ms per frame (60 fps target).

## Browser Support

Last two versions of Chrome, Firefox, and Safari on desktop and Android. iOS Safari in scope. No IE or legacy Edge.

## Build and Dev Commands

- dev — Vite dev server with HMR
- build — production build to dist/
- preview — serve the production build locally
- test — Vitest watch mode
- test:run — Vitest single run (CI)
- typecheck — tsc --noEmit
