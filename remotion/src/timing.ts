import type {
  ActionScene,
  DialogueScene,
  Scene,
  Screenplay,
  StatsScene,
  TitleScene,
} from "./screenplay";

/**
 * Frame math and per-scene schedules shared by every consumer — scene
 * components, audio cues (src/audio/events.ts), and voiceover scheduling.
 * One source of truth: a scene's pacing is defined here and nowhere else
 * (this module replaces the mirrored constants events.ts used to carry).
 * All values are scene-LOCAL frames unless a function takes the screenplay.
 */

export const sceneFrames = (scene: Scene, fps: number): number =>
  Math.max(1, Math.round(scene.targetSec * fps));

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

// ── title ────────────────────────────────────────────────────────────────────

export interface TitleSchedule {
  /** Cold-open flash length; 0 when the scene has no coldOpen. */
  coldOpenFrames: number;
  /** Typing starts this many frames into the CARD (i.e. after the cold open). */
  typingStart: number;
  charsPerFrame: number;
  /** Card-local frame when the last character lands. */
  typingEnd: number;
  /** Scene-local frame where the caption starts fading in. */
  captionIn: number;
}

/** The prompt types itself out, always finishing by ~65% of the card. */
export const titleSchedule = (scene: TitleScene, durationInFrames: number): TitleSchedule => {
  const coldOpenFrames = scene.coldOpen ? Math.round(durationInFrames * 0.22) : 0;
  const typingStart = 15;
  const cardFrames = durationInFrames - coldOpenFrames;
  const charsPerFrame = Math.max(
    0.9,
    scene.task.length / Math.max(10, cardFrames * 0.65 - typingStart),
  );
  const typingEnd = typingStart + scene.task.length / charsPerFrame;
  return {
    coldOpenFrames,
    typingStart,
    charsPerFrame,
    typingEnd,
    captionIn: coldOpenFrames + typingEnd + 5,
  };
};

// ── action ───────────────────────────────────────────────────────────────────

export interface ActionSchedule {
  /** Chips all land inside this window, whatever the event count. */
  streamFrames: number;
  interval: number;
  slideDur: number;
  /** Scene-local frame where chip i starts sliding in. */
  chipStart: (i: number) => number;
  /** Scene-local frame where chip i lands (the SFX tick). */
  chipLanded: (i: number) => number;
  captionIn: number;
}

export const actionSchedule = (scene: ActionScene, durationInFrames: number): ActionSchedule => {
  const streamFrames = durationInFrames * (scene.intensity === "montage" ? 0.75 : 0.9);
  const interval = Math.max(1.5, (streamFrames - 10) / scene.events.length);
  const slideDur = Math.min(12, Math.max(3, interval));
  return {
    streamFrames,
    interval,
    slideDur,
    chipStart: (i) => 10 + i * interval,
    chipLanded: (i) => 10 + i * interval + slideDur,
    captionIn: 8,
  };
};

// ── showcase ─────────────────────────────────────────────────────────────────

export interface ShowcaseSchedule {
  panelInDur: number;
  /** Removed diff lines start collapsing here. */
  collapseStart: number;
  /** The verdict banner (and its SFX) lands here. */
  verdictStart: number;
  captionIn: number;
  /** testRun artifact: command typing + exit badge. */
  testRun: { typeStart: number; typeEnd: number; badgeStart: number };
}

export const showcaseSchedule = (durationInFrames: number): ShowcaseSchedule => ({
  panelInDur: 15,
  collapseStart: Math.round(durationInFrames * 0.12),
  verdictStart: Math.round(durationInFrames * 0.78),
  captionIn: 10,
  testRun: {
    typeStart: 12,
    typeEnd: Math.max(20, durationInFrames * 0.25),
    badgeStart: Math.round(durationInFrames * 0.45),
  },
});

// ── dialogue ─────────────────────────────────────────────────────────────────

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
  // Dialogue components delay the bubble train past the lead-in.
  return { usable, interval, lineStart: (i) => 10 + i * interval, captionIn: 6 };
};

// ── stats ────────────────────────────────────────────────────────────────────

export interface StatsSchedule {
  countsStart: number;
  achievementsStart: number;
  gradeStart: number;
  captionIn: number;
}

export const statsSchedule = (scene: StatsScene, durationInFrames: number): StatsSchedule => {
  const countsStart = 20;
  // Fixed 90 starved short stats scenes (a 3s scene never showed its trophies);
  // identical to the old constant for scenes of ~6.7s and longer.
  const achievementsStart = Math.min(90, Math.round(durationInFrames * 0.45));
  const gradeStart = Math.min(
    durationInFrames - 60,
    achievementsStart + scene.achievements.length * 15 + 25,
  );
  return { countsStart, achievementsStart, gradeStart, captionIn: gradeStart + 20 };
};

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
      return actionSchedule(scene, durationInFrames).captionIn;
    case "showcase":
      return showcaseSchedule(durationInFrames).captionIn;
    case "dialogue":
      return Math.round(dialogueSchedule(scene, durationInFrames).captionIn);
    case "stats":
      return statsSchedule(scene, durationInFrames).captionIn;
  }
};
