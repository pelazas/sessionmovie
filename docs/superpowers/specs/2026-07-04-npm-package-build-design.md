# npm package build step — design

**Date:** 2026-07-04
**Status:** approved
**Scope:** build step + bin wiring only. Publish-readiness (`files` whitelist, flipping `private: true`, tarball smoke test, `npm publish`) is explicitly deferred.

## Problem

`npx sessionmovie` is the product (docs/distribution-and-cost.md), but today every CLI
entrypoint runs through `tsx`, a devDependency. npx consumers must not need tsx: the
package needs a build step that emits plain JS and a `bin` entry pointing at it.

The complication: `src/` imports TypeScript straight out of the Remotion workspace —
`remotion/src/audio/beats.ts`, `remotion/src/audio/questBeats.ts`, `remotion/src/timing.ts`,
`remotion/src/packs/voiceoverSync.ts` (from `src/cli/movie.ts` and `src/voiceover/manifest.ts`).
`voiceoverSync.ts` deliberately uses extensionless internal imports (webpack side), which
plain `tsc`-emitted JS cannot resolve under Node ESM. So `tsc` on `src/` alone cannot
produce a runnable `dist/`.

## Decision

Bundle the CLI with **tsup** (approach A). Alternatives considered and rejected:

- **Plain `tsc` emit** (`rootDir` at repo root): requires rewriting `voiceoverSync.ts`'s
  deliberate extensionless imports, produces a deeper `dist/src/…` + `dist/remotion/src/…`
  layout, and lands compiled copies of renderer files in dist as a second source of truth.
- **Restructure shared modules into `src/shared/`**: cleanest long-term, but inverts the
  current dependency direction, touches composition code, and is a far bigger diff than
  "build + bin" warrants (CLAUDE.md warns against speculative restructuring).

Bundling inlines the cross-boundary imports without touching any renderer code.

## Design

### 1. Bin entry + routing (`src/cli/bin.ts`, new)

~12 lines with a `#!/usr/bin/env node` shebang. Router: if `process.argv[2] === "doctor"`,
splice it out of argv and dynamically `import("./doctor.js")`; otherwise `import("./movie.js")`.

- Dynamic import is load-bearing: both modules execute at import time.
- `movie.ts` and `doctor.ts` need zero routing changes — doctor reads no argv; movie
  already treats `argv.slice(2)` as its args, and with no subcommand word there is
  nothing to strip. The only edit to `movie.ts` is the usage-string line below.
- Bin surface is **movie + doctor only** (matches docs/distribution-and-cost.md).
  `parse` and `validate` remain dev-only npm scripts on tsx.
- One-line addition to `usage()` in `movie.ts` mentioning `sessionmovie doctor`.

### 2. Build config

- `tsup` as a devDependency; `tsup.config.ts` at repo root: entry `src/cli/bin.ts`,
  `format: esm`, `platform: node`, `target: node20`, sourcemaps on, `clean: true`,
  output dir `dist/`.
- Output is `dist/bin.js` plus split chunks for the two dynamic imports; esbuild
  preserves the shebang on the entry.
- `zod` is in `dependencies`, so tsup externalizes it automatically; everything else —
  including the `remotion/src` beat/timing/sync modules — is inlined.
- `tsc --noEmit` remains the typechecker; tsx remains for dev scripts and `npm test`.

### 3. `repoRoot` derivation fix (`src/cli/workspace.ts`)

The only real code change. `repoRoot` is currently "two levels up from this file"
(`src/cli/` → root), which is wrong when the code runs from `dist/`. Replace with a
walk-up: from `dirname(fileURLToPath(import.meta.url))`, ascend until a directory
contains a `package.json` whose `name` is `"sessionmovie"`; fail loudly if the
filesystem root is reached. Correct from `src/cli/` (tsx dev), `dist/` (built), and tests.

### 4. package.json changes

- `"bin": { "sessionmovie": "dist/bin.js" }`
- `"scripts.build": "tsup"`
- `"engines": { "node": ">=20" }`
- Everything else unchanged, including `private: true` (deferred publish work).

### 5. Verification

- `npm run build` succeeds.
- `node dist/bin.js doctor` runs the doctor checks.
- `node dist/bin.js <smallest fixture> --no-llm --out <tmp>/movie.mp4` renders
  end-to-end with no tsx involvement (node executes plain JS; tsx is never loaded).
- `npm run typecheck` and `npm test` stay green.
- No new unit tests: the router is smoke-covered by the runs above.

## Error handling

Unchanged. Exit codes (0 rendered, 2 graceful decline, 1 error) and all failure paths
live in `movie.ts` / `doctor.ts`, which this design does not modify (beyond the one
usage-string line).

## Constraints check (CLAUDE.md)

- No render path changes → redaction layer untouched.
- No composition changes → determinism untouched.
- Screenplay IR untouched.
- No new assets.
