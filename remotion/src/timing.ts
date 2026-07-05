import type { DialogueScene, Scene, Screenplay, TitleScene } from "./screenplay";
// sceneFrames moved to src/voiceover/sync-core.ts (CLI-side) so the CLI never
// imports a renderer module — re-exported here so every renderer-side
// consumer that imports it from "./timing"/"../timing"/etc. keeps working.
import { sceneFrames } from "../../src/voiceover/sync-core";
export { sceneFrames };

/**
 * Frame math and per-scene schedules shared by every consumer — scene
 * components, audio cues (src/audio/events.ts), and voiceover scheduling.
 * One source of truth: a scene's pacing is defined here and nowhere else
 * (this module replaces the mirrored constants events.ts used to carry).
 * All values are scene-LOCAL frames unless a function takes the screenplay.
 */

export const totalFrames = (screenplay: Screenplay, fps: number): number =>
  screenplay.scenes.reduce((sum, s) => sum + sceneFrames(s, fps), 0);

/** Global first frame of scenes[index]. */
export const sceneStartFrame = (screenplay: Screenplay, index: number, fps: number): number =>
  screenplay.scenes.slice(0, index).reduce((acc, s) => acc + sceneFrames(s, fps), 0);

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

// ── title (no cold open): characters walk in, then the task types out ──────

export interface TitleSchedule {
  /** Scene-local frame where both characters' walk-in has landed. */
  walkInEnd: number;
  typingStart: number;
  charsPerFrame: number;
  /** Scene-local frame when the last character lands. */
  typingEnd: number;
  /** Scene-local frame where the caption starts fading in. */
  captionIn: number;
}

/** The prompt types itself out, always finishing by ~70% of the scene. */
export const titleSchedule = (scene: TitleScene, durationInFrames: number): TitleSchedule => {
  const walkInEnd = Math.min(30, Math.round(durationInFrames * 0.25));
  const typingStart = walkInEnd + 6;
  const charsPerFrame = Math.max(
    0.9,
    scene.task.length / Math.max(10, durationInFrames * 0.7 - typingStart),
  );
  const typingEnd = typingStart + scene.task.length / charsPerFrame;
  return { walkInEnd, typingStart, charsPerFrame, typingEnd, captionIn: typingEnd + 6 };
};

// ── artifact (shared by action + showcase) ──────────────────────────────────

export interface ArtifactSchedule {
  panelInDur: number;
  typeStart: number;
  typeEnd: number;
  revealStart: number;
  captionIn: number;
}

export const artifactSchedule = (durationInFrames: number): ArtifactSchedule => ({
  panelInDur: 12,
  typeStart: 14,
  typeEnd: Math.max(24, Math.round(durationInFrames * 0.55)),
  revealStart: Math.round(durationInFrames * 0.72),
  captionIn: 10,
});

// ── dialogue (unchanged shape — only uses scene.lines) ──────────────────────

export interface DialogueSchedule {
  /** Bubbles all land within the first ~70% of the scene. */
  usable: number;
  interval: number;
  /** Scene-local frame where bubble i pops in. */
  lineStart: (i: number) => number;
  captionIn: number;
}

export const dialogueSchedule = (
  scene: DialogueScene,
  durationInFrames: number,
): DialogueSchedule => {
  const usable = durationInFrames * 0.7;
  const interval = Math.max(6, (usable - 10) / scene.lines.length);
  // captionIn is EARLY (text economy, docs/v1-storychange.md): in dialogue
  // scenes caption + narration are a LEAD-IN before the first bubble — one
  // voice at a time, never caption text over a popping bubble. Voiceover cue
  // scheduling reads this same value, so narration starts here too; the
  // Dialogue component delays the bubble train past the lead-in.
  return { usable, interval, lineStart: (i) => 10 + i * interval, captionIn: 6 };
};

/** Caption is fully released this many frames after narration ends (sync
 * contract; voiceoverSync re-exports this as CAPTION_RELEASE_END). */
export const CAPTION_RELEASE_END = 15;
/** Frames between narration end and the first bubble pop: full caption
 * release plus a small safety margin. */
export const DIALOGUE_LEAD_RELEASE = CAPTION_RELEASE_END + 4;

/**
 * One voice at a time (docs/v1-storychange.md): when a dialogue scene has
 * narration, caption + narration play as a LEAD-IN and the bubble train runs
 * in the remaining window — same schedule shape, shifted past the lead-in.
 * Without narration there is no lead-in: bubbles start immediately and a
 * caption (if any) is a closing beat after the last bubble, fading in at
 * `usable` (the spec's sanctioned dialogue-caption use).
 *
 * The lead-in is clamped to 60% of the scene so a hand-fed over-long cue
 * degrades to a compressed bubble train instead of no bubbles at all — the
 * manifest fit gate already caps real dialogue cues well below this.
 */
export const dialogueLeadSchedule = (
  scene: DialogueScene,
  durationInFrames: number,
  cueEndFrame: number | null,
): DialogueSchedule & { leadInEnd: number } => {
  const leadInEnd =
    cueEndFrame === null
      ? 0
      : Math.min(cueEndFrame + DIALOGUE_LEAD_RELEASE, Math.round(durationInFrames * 0.6));
  const shifted = dialogueSchedule(scene, Math.max(1, durationInFrames - leadInEnd));
  return {
    leadInEnd,
    usable: leadInEnd + shifted.usable,
    interval: shifted.interval,
    lineStart: (i) => leadInEnd + shifted.lineStart(i),
    captionIn: shifted.captionIn,
  };
};

/** THE VO SEAM (PR-H): Dialogue.tsx calls ONLY this. Today one caption cue
 * drives the whole scene's lead-in; PR-H reimplements this to start each
 * bubble at its own line's VO cue — Dialogue.tsx does not change. */
export interface BubbleSchedule {
  lineStart: (i: number) => number;
  usable: number;
  captionIn: number;
}
export const dialogueBubbleSchedule = (
  scene: DialogueScene,
  durationInFrames: number,
  cueEndFrame: number | null,
): BubbleSchedule => {
  const s = dialogueLeadSchedule(scene, durationInFrames, cueEndFrame);
  return { lineStart: s.lineStart, usable: s.usable, captionIn: s.captionIn };
};

// ── stats (cards come from the sidecar) ─────────────────────────────────────

export interface StatsSchedule {
  compressionIn: number;
  cardsStart: number;
  cardStagger: number;
  watermarkIn: number;
  captionIn: number;
}

export const statsSchedule = (durationInFrames: number): StatsSchedule => ({
  compressionIn: 12,
  cardsStart: 28,
  cardStagger: 8,
  watermarkIn: Math.round(durationInFrames * 0.78),
  captionIn: Math.round(durationInFrames * 0.85),
});

// ── captions (voiceover alignment) ───────────────────────────────────────────

/**
 * Scene-local frame where the scene's caption starts fading in — voiceover
 * cues align narration start to this instead of the scene's first frame
 * (issue #9 note from the PR #14 review).
 */
export const captionInFrame = (scene: Scene, durationInFrames: number): number => {
  switch (scene.type) {
    case "title":
      return Math.round(titleSchedule(scene, durationInFrames).captionIn);
    case "action":
      return artifactSchedule(durationInFrames).captionIn;
    case "showcase":
      return artifactSchedule(durationInFrames).captionIn;
    case "dialogue":
      return Math.round(dialogueSchedule(scene, durationInFrames).captionIn);
    case "stats":
      return statsSchedule(durationInFrames).captionIn;
  }
};
