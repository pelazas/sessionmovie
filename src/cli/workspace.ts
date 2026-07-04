/**
 * Shared workspace plumbing for the CLI entrypoints: where the repo lives,
 * where the Remotion workspace lives, and how to spawn `npx` inside it.
 * CLI-only — nothing here may leak into parser/screenwriter/composition code.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, derived from this file's location (src/cli/ → two levels up). */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The Remotion workspace — `npx remotion …` must run with this as cwd. */
export const remotionDir = join(repoRoot, "remotion");

/** True when `npm install` has run and the Remotion CLI is resolvable. */
export function remotionCliInstalled(): boolean {
  return (
    existsSync(join(repoRoot, "node_modules", "@remotion", "cli", "package.json")) ||
    existsSync(join(remotionDir, "node_modules", "@remotion", "cli", "package.json"))
  );
}

/**
 * Run `npx <args>` inside the Remotion workspace, streaming output to the
 * user's terminal (honest progress beats a silent multi-minute hang).
 * Resolves with the exit code; never throws on non-zero exit.
 */
export function runNpx(args: string[]): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(npx, args, { cwd: remotionDir, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}
