import { cpSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

/**
 * Bundle the CLI (docs/superpowers/specs/2026-07-04-npm-package-build-design.md).
 * Bundling — not plain tsc — because src/ imports TypeScript straight out of
 * remotion/src (beats, timing, voiceoverSync), whose deliberate extensionless
 * internal imports Node ESM cannot resolve from tsc-emitted JS.
 */
export default defineConfig({
  entry: { bin: "src/cli/bin.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  splitting: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  onSuccess: async () => {
    // llm.ts reads prompts/<version>.md next to its emitted chunk at runtime.
    cpSync(join("src", "screenwriter", "prompts"), join("dist", "prompts"), {
      recursive: true,
    });
  },
});
