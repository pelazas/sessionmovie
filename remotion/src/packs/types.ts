import type {
  ActionScene,
  DialogueScene,
  Screenplay,
  ShowcaseScene,
  StatsScene,
  TitleScene,
} from "../screenplay";
import { createContext } from "react";
import type { SceneVoiceoverLineCue, VoiceoverManifest } from "../../../src/voiceover/types";

/**
 * The GenrePack contract (docs/genre-packs.md), extracted at the second pack
 * (issue #9, since removed — docs/genre-packs.md "Extraction status"). A pack
 * renders every scene type; that is what keeps packs interchangeable and the
 * screenwriter genre-blind.
 */

/** Props every pack scene component receives — same shape for all types. */
export interface SceneProps<S> {
  scene: S;
  screenplay: Screenplay;
  durationInFrames: number;
}

export interface GenrePack {
  /** Registry key ("classic") — also the CLI's --genre id via src/genre. */
  id: string;
  /** Remotion composition id ("Classic"). */
  compositionId: string;
  components: {
    title: React.FC<SceneProps<TitleScene>>;
    dialogue: React.FC<SceneProps<DialogueScene>>;
    action: React.FC<SceneProps<ActionScene>>;
    showcase: React.FC<SceneProps<ShowcaseScene>>;
    stats: React.FC<SceneProps<StatsScene>>;
  };
  /** The pack's soundtrack layer (music bed + SFX + voiceover cues). */
  Audio: React.FC<{ screenplay: Screenplay & { voiceover?: VoiceoverManifest } }>;
  /** Canvas color behind every scene. */
  background: string;
  /** Prompt fragment for the punch-up pass — the genre's voice. */
  captionPersona: string;
}

// ── dialogue voiceover plumbing (rewrite/voiceover-dialogue, PR-H) ──────────
/**
 * The current DIALOGUE scene's per-line narration track (scene-local frames),
 * provided by PackComposition — null for every non-dialogue scene, or a
 * dialogue scene with no --voiceover. Dialogue.tsx falls back to
 * dialogueBubbleSchedule (the no-VO schedule) when null.
 */
export const DialogueTrackContext = createContext<SceneVoiceoverLineCue[] | null>(null);
export type { SceneVoiceoverLineCue };
