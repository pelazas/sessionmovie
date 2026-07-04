/**
 * Shared workspace plumbing for the CLI entrypoints: where the package lives,
 * where the Remotion project lives, and how to spawn the Remotion CLI there.
 * CLI-only — nothing here may leak into parser/screenwriter/composition code.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Package root: walk up from this file to the package.json named
 * "sessionmovie". Correct from src/cli/ (tsx dev), dist/ (built bundle),
 * and an installed node_modules/sessionmovie.
 */
function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const name = (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name;
        if (name === "sessionmovie") return dir;
      } catch {
        // unreadable package.json on the way up — keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `sessionmovie package root not found walking up from ${fileURLToPath(import.meta.url)}`,
      );
    }
    dir = parent;
  }
}

export const repoRoot = findPackageRoot();

/** The Remotion project — the Remotion CLI must run with this as cwd. */
export const remotionDir = join(repoRoot, "remotion");

// Resolves against THIS package's dependencies wherever it is installed —
// never against the user's cwd (npx from a consumer's project would fetch a
// fresh, wrong-version Remotion instead of the one we pin).
const requireFromHere = createRequire(import.meta.url);

/** Absolute path to @remotion/cli's executable script, or null when not installed. */
export function remotionCliPath(): string | null {
  try {
    const pkgPath = requireFromHere.resolve("@remotion/cli/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["remotion"];
    return rel ? join(dirname(pkgPath), rel) : null;
  } catch {
    return null;
  }
}

/** True when the Remotion CLI is resolvable from this package. */
export function remotionCliInstalled(): boolean {
  return remotionCliPath() !== null;
}

/** Version of the resolved @remotion/cli — cosmetic-only, "" when unknown. */
export function remotionCliVersion(): string {
  try {
    const pkgPath = requireFromHere.resolve("@remotion/cli/package.json");
    return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }).version ?? "";
  } catch {
    return "";
  }
}

/**
 * Run `remotion <args>` inside the Remotion project by handing the resolved
 * CLI script to the current Node, streaming output to the user's terminal
 * (honest progress beats a silent multi-minute hang).
 * Resolves with the exit code; never throws on non-zero exit.
 */
export function runRemotion(args: string[]): Promise<number> {
  const cli = remotionCliPath();
  if (cli === null) return Promise.resolve(1); // callers gate on remotionCliInstalled()
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: remotionDir,
      stdio: "inherit",
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}
