/**
 * Voiceover measurement helpers shared by the CLI's synth/resize pipeline
 * (src/voiceover/pace.ts): probing a synthesized clip's real duration and
 * reading back its character-alignment sidecar.
 *
 * All API calls happen pre-render — never inside compositions (docs/audio.md
 * hard rule; keeps renders deterministic and Lambda-viable).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { remotionDir } from "../cli/workspace.js";
import type { CharacterAlignment } from "./types.js";

export const FPS = 30; // mirrors the composition fps (remotion/src/Root.tsx)

/** Measure audio duration with Remotion's bundled ffprobe (no new dependency). */
export function probeDurationSec(absolutePath: string): number {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const run = spawnSync(npx, ["remotion", "ffprobe", absolutePath], {
    cwd: remotionDir,
    encoding: "utf8",
    timeout: 60_000,
  });
  // ffprobe prints metadata to stderr; be liberal about which stream has it.
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (run.error || !match) {
    throw new Error(
      `ffprobe could not measure ${absolutePath}: ${run.error ?? output.slice(-300)}`,
    );
  }
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Default sidecar reader; a missing/corrupt sidecar degrades to no-highlight. */
export function readAlignmentFile(timestampsPath: string): CharacterAlignment | null {
  try {
    return JSON.parse(readFileSync(timestampsPath, "utf8")) as CharacterAlignment | null;
  } catch {
    return null;
  }
}
