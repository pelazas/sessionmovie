import type { Screenplay } from "../screenplay";
import { actionSchedule, sceneFrames, showcaseSchedule, titleSchedule } from "../timing";

// Derives every SFX cue frame from the screenplay with pure frame math.
// All schedules come from src/timing.ts — the same module the scene
// components read — so audio and picture cannot drift apart.

export type SfxKind = "thock" | "tick" | "fail" | "pass";
export type SfxCue = { kind: SfxKind; frame: number };

export { sceneCutFrames } from "../timing";

/** Keyboard thocks while the title prompt types. */
const titleCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "title" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const { coldOpenFrames, typingStart, typingEnd } = titleSchedule(scene, durationInFrames);
  const cues: SfxCue[] = [];
  // One thock per ~4 frames of typing reads as keystrokes without machine-gunning.
  for (let f = typingStart; f < typingEnd; f += 4) {
    cues.push({ kind: "thock", frame: start + coldOpenFrames + Math.round(f) });
  }
  return cues;
};

/** A tick as each tool chip lands. */
const actionCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "action" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const { chipLanded } = actionSchedule(scene, durationInFrames);
  return scene.events.map((_e, i) => ({
    kind: "tick" as const,
    frame: start + Math.round(chipLanded(i)),
  }));
};

/** All SFX cues for the movie, in global frames. */
export const collectCues = (screenplay: Screenplay, fps: number): SfxCue[] => {
  const cues: SfxCue[] = [];
  let start = 0;
  for (const scene of screenplay.scenes) {
    const frames = sceneFrames(scene, fps);
    switch (scene.type) {
      case "title":
        cues.push(...titleCues(scene, start, frames));
        break;
      case "action":
        cues.push(...actionCues(scene, start, frames));
        break;
      case "showcase": {
        const { verdictStart } = showcaseSchedule(frames);
        if (scene.verdict === "fail") cues.push({ kind: "fail", frame: start + verdictStart });
        if (scene.verdict === "pass") cues.push({ kind: "pass", frame: start + verdictStart });
        break;
      }
      default:
        break;
    }
    start += frames;
  }
  return cues;
};
