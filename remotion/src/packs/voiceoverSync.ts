import type { SceneVoiceoverLineCue, VoiceoverLineCue } from "../../../src/voiceover/types";
import { VO_GAP_SEC, VO_LEAD_SEC, wordsFromAlignment } from "../../../src/voiceover/sync-core";
export { wordsFromAlignment };

/** All line cues for one dialogue scene → scene-local frames, laid end-to-end
 *  from a 0.75s lead with 0.35s gaps (mirrors resizeDialogueToVoiceover). */
export function sceneLocalTrack(lineCues: VoiceoverLineCue[], sceneIndex: number, fps: number): SceneVoiceoverLineCue[] {
  const forScene = lineCues.filter((c) => c.sceneIndex === sceneIndex).sort((a, b) => a.lineIndex - b.lineIndex);
  const gap = Math.round(VO_GAP_SEC * fps);
  let cursor = Math.round(VO_LEAD_SEC * fps);
  return forScene.map((c) => {
    const startFrame = cursor;
    const dur = Math.round(c.durationSec * fps);
    cursor = startFrame + dur + gap;
    return {
      lineIndex: c.lineIndex, startFrame, endFrame: startFrame + dur,
      words: c.words.map((w) => ({ text: w.word, startFrame: startFrame + Math.round(w.startSec * fps), endFrame: startFrame + Math.round(w.endSec * fps) })),
    };
  });
}
