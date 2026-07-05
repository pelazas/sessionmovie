import type { ActionArtifact, Screenplay } from "../screenplay";
import { artifactSchedule, sceneFrames, titleSchedule } from "../timing";

// Derives every SFX cue frame from the screenplay with pure frame math.
// All schedules come from src/timing.ts — the same module the scene
// components read — so audio and picture cannot drift apart.

// SfxKind stays exactly as-is (thock|tick|pass|fail|whoosh|drone|stinger) so
// ClassicAudio's SHARED_SFX/SHARED_SFX_VOLUMES maps need no change — this PR
// just stops EMITTING drone (no more fail-streak concept in the v2 artifact
// shape: a single command either exits 0 or it doesn't).
export type SfxKind = "thock" | "tick" | "pass" | "fail" | "whoosh" | "drone" | "stinger";
export type SfxCue = {
  kind: SfxKind;
  frame: number;
  /** Clamp playback to this many frames (long assets must not bleed across cuts). */
  maxFrames?: number;
};

export { sceneCutFrames } from "../timing";

/** Keyboard thocks while the title prompt types. */
const titleCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "title" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const { typingStart, typingEnd } = titleSchedule(scene, durationInFrames);
  const cues: SfxCue[] = [];
  // One thock per ~4 frames of typing reads as keystrokes without machine-gunning.
  for (let f = typingStart; f < typingEnd; f += 4) {
    cues.push({ kind: "thock", frame: start + Math.round(f) });
  }
  return cues;
};

/** SFX for a single action/showcase artifact: thocks while typing, ticks per
 * created file / spawned subagent, and a pass/fail chime at the reveal for a
 * command's exit code (v2 has no other pass/fail signal). */
const artifactCues = (artifact: ActionArtifact, start: number, durationInFrames: number): SfxCue[] => {
  const { typeStart, typeEnd, revealStart } = artifactSchedule(durationInFrames);
  const cues: SfxCue[] = [];
  if (artifact.kind === "edit" || artifact.kind === "command") {
    for (let f = typeStart; f < typeEnd; f += 4) {
      cues.push({ kind: "thock", frame: start + Math.round(f) });
    }
  }
  if (artifact.kind === "create" || artifact.kind === "subagents") {
    const n = artifact.kind === "create" ? artifact.files.length : artifact.tasks.length;
    for (let i = 0; i < n; i++) {
      cues.push({ kind: "tick", frame: start + typeStart + i * 8 });
    }
  }
  if (artifact.kind === "command") {
    cues.push({ kind: artifact.exitCode === 0 ? "pass" : "fail", frame: start + revealStart });
  }
  return cues;
};

/** All SFX cues for the movie, in global frames. */
export const collectCues = (screenplay: Screenplay, fps: number): SfxCue[] => {
  const cues: SfxCue[] = [];
  let start = 0;
  for (const [index, scene] of screenplay.scenes.entries()) {
    const frames = sceneFrames(scene, fps);
    // Transition whoosh at every scene handoff (matches the 4-frame visual
    // transition in PackComposition); end stinger when the stats card opens.
    // Both derive from the same frame math as the picture.
    if (index > 0) cues.push({ kind: "whoosh", frame: start }); // matches the flash peak on the cut
    switch (scene.type) {
      case "title":
        cues.push(...titleCues(scene, start, frames));
        break;
      case "action":
        cues.push(...artifactCues(scene.artifact, start, frames));
        break;
      case "showcase": {
        const { revealStart } = artifactSchedule(frames);
        cues.push({ kind: "pass", frame: start + revealStart });
        cues.push(...artifactCues(scene.artifact, start, frames));
        break;
      }
      case "stats":
        cues.push({ kind: "stinger", frame: start });
        break;
      default:
        break;
    }
    start += frames;
  }
  return cues;
};
