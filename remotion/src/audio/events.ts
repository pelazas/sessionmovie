import type { Screenplay } from "../screenplay";
import { actionSchedule, sceneFrames, showcaseSchedule, titleSchedule } from "../timing";

// Derives every SFX cue frame from the screenplay with pure frame math.
// All schedules come from src/timing.ts — the same module the scene
// components read — so audio and picture cannot drift apart.

// feat/effects additive kinds: whoosh (scene cuts), drone (action fail
// streak), stinger (stats open). Cue derivation stays schedule-driven.
export type SfxKind = "thock" | "tick" | "fail" | "pass" | "whoosh" | "drone" | "stinger";
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

/**
 * A tick as each tool chip lands, plus (feat/effects) a tension drone when a
 * fail streak opens: the first ok:false chip whose successor is also ok:false.
 * chipLanded() stays the single landing source of truth — the visual speed
 * ramp compresses slide-in durations, never landing frames.
 */
const actionCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "action" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const { chipLanded } = actionSchedule(scene, durationInFrames);
  const cues: SfxCue[] = scene.events.map((_e, i) => ({
    kind: "tick" as const,
    frame: start + Math.round(chipLanded(i)),
  }));
  const streakStart = scene.events.findIndex(
    (e, i) => e.ok === false && scene.events[i + 1]?.ok === false,
  );
  if (streakStart >= 0) {
    cues.push({ kind: "drone", frame: start + Math.round(chipLanded(streakStart)) });
  }
  return cues;
};

/** All SFX cues for the movie, in global frames. */
export const collectCues = (screenplay: Screenplay, fps: number): SfxCue[] => {
  const cues: SfxCue[] = [];
  let start = 0;
  for (const [index, scene] of screenplay.scenes.entries()) {
    const frames = sceneFrames(scene, fps);
    // feat/effects: transition whoosh at every scene handoff (matches the
    // 2-frame visual transition in PackComposition), end stinger when the
    // stats card opens. Both derive from the same frame math as the picture.
    if (index > 0) cues.push({ kind: "whoosh", frame: start - 2 });
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
