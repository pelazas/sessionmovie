import type { Screenplay } from "../screenplay";
import { sceneFrames } from "../timing";

// Derives every SFX cue frame from the screenplay with pure frame math.
//
// The typing/chip/verdict constants below MIRROR the scene components
// (Title.tsx, Action.tsx, Showcase.tsx) — the audio layer may not restructure
// scenes, and the scenes don't export their internals yet. When the GenrePack
// interface is extracted (genre #2), these schedules should move into one
// shared timing module. Until then: change a scene's pacing constants, change
// them here too.

export type SfxKind = "thock" | "tick" | "fail" | "pass";
export type SfxCue = { kind: SfxKind; frame: number };

/** Global frames where one scene hands off to the next (excludes frame 0). */
export const sceneCutFrames = (screenplay: Screenplay, fps: number): number[] => {
  const cuts: number[] = [];
  let acc = 0;
  for (const scene of screenplay.scenes.slice(0, -1)) {
    acc += sceneFrames(scene, fps);
    cuts.push(acc);
  }
  return cuts;
};

/** Keyboard thocks while the title prompt types — mirrors Title.tsx. */
const titleCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "title" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const coldOpenFrames = scene.coldOpen ? Math.round(durationInFrames * 0.22) : 0;
  const typingStart = 15;
  const cardFrames = durationInFrames - coldOpenFrames;
  const charsPerFrame = Math.max(
    0.9,
    scene.task.length / Math.max(10, cardFrames * 0.65 - typingStart),
  );
  const typingEnd = typingStart + scene.task.length / charsPerFrame;
  const cues: SfxCue[] = [];
  // One thock per ~4 frames of typing reads as keystrokes without machine-gunning.
  for (let f = typingStart; f < typingEnd; f += 4) {
    cues.push({ kind: "thock", frame: start + coldOpenFrames + Math.round(f) });
  }
  return cues;
};

/** A tick as each tool chip lands — mirrors Action.tsx's stream math. */
const actionCues = (
  scene: Extract<Screenplay["scenes"][number], { type: "action" }>,
  start: number,
  durationInFrames: number,
): SfxCue[] => {
  const streamFrames = durationInFrames * (scene.intensity === "montage" ? 0.75 : 0.9);
  const interval = Math.max(1.5, (streamFrames - 10) / scene.events.length);
  const slideDur = Math.min(12, Math.max(3, interval));
  return scene.events.map((_e, i) => ({
    kind: "tick" as const,
    frame: start + Math.round(10 + i * interval + slideDur),
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
        // Verdict banner lands at 78% of the scene — mirrors Showcase.tsx.
        const verdictFrame = start + Math.round(frames * 0.78);
        if (scene.verdict === "fail") cues.push({ kind: "fail", frame: verdictFrame });
        if (scene.verdict === "pass") cues.push({ kind: "pass", frame: verdictFrame });
        break;
      }
      default:
        break;
    }
    start += frames;
  }
  return cues;
};
