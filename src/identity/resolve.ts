/**
 * GitHub login resolution — CLI-side only, pipeline time (no network calls
 * from Remotion compositions; docs/security-and-privacy.md "GitHub identity
 * carve-out"). Every step is short-timeout and silent-fails to the next; this
 * never throws and never hangs the render.
 */
import { spawnSync } from "node:child_process";

const EXEC_TIMEOUT_MS = 3_000;

export type CommandRunner = (cmd: string, args: string[]) => string | null;

/** Runs a command with a short timeout; trimmed stdout, or null on any failure (missing binary, non-zero exit, timeout). Never throws. */
function runCommand(cmd: string, args: string[]): string | null {
  try {
    const result = spawnSync(cmd, args, {
      timeout: EXEC_TIMEOUT_MS,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.error || result.status !== 0) return null;
    const out = result.stdout?.trim();
    return out ? out : null;
  } catch {
    return null;
  }
}

const NOREPLY_PATTERN = /^\d+\+([^@]+)@users\.noreply\.github\.com$/;

/**
 * Resolve the current user's GitHub login for the avatar carve-out
 * (docs/security-and-privacy.md). Tried in order, each step silently
 * falling through to the next on any failure:
 *
 *   (a) `gh api user --jq .login` — authoritative when the gh CLI is
 *       installed and logged in.
 *   (b) `git config user.email` matched against GitHub's noreply pattern
 *       `<id>+<login>@users.noreply.github.com` — common when gh isn't set
 *       up but git carries a GitHub-issued noreply address.
 *   (c) `git config github.user` — an explicit manual override some users set.
 *   (d) null — no identity resolvable; caller falls back to initials.
 */
export function resolveGitHubLogin(run: CommandRunner = runCommand): string | null {
  const viaGh = run("gh", ["api", "user", "--jq", ".login"]);
  if (viaGh) return viaGh;

  const email = run("git", ["config", "user.email"]);
  const match = email?.match(NOREPLY_PATTERN);
  if (match?.[1]) return match[1];

  const viaConfig = run("git", ["config", "github.user"]);
  if (viaConfig) return viaConfig;

  return null;
}

/**
 * Best-effort display name for the initials fallback (docs/characters.md):
 * `git config user.name`, else the resolved GitHub login, else "?". Each
 * step is independent so a missing git config doesn't hide a known login.
 */
export function resolveDisplayName(login: string | null, run: CommandRunner = runCommand): string {
  return run("git", ["config", "user.name"]) ?? login ?? "?";
}
