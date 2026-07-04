import type { Scene, Screenplay } from "./screenplay";

/**
 * Frame math shared by every consumer — packs, audio cues, voiceover
 * scheduling. One source of truth: a scene's frame count and start frame are
 * defined here and nowhere else.
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
