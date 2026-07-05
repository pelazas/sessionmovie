import type {
  ActionScene,
  DialogueScene,
  Screenplay,
  ShowcaseScene,
  StatsScene,
  TitleScene,
} from "../screenplay";
import { createContext } from "react";
import type { SceneVoiceoverCue, VoiceoverManifest } from "../../../src/voiceover/types";

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

// ── voiceover cue plumbing (feat/vo-sync) ────────────────────────────────────
/**
 * The current scene's narration cue, provided by PackComposition and consumed
 * by Caption — scenes stay untouched. null = no cue (no --voiceover, caption
 * skipped by the fit rule, or captionless scene): Caption then behaves
 * exactly as before (schedule-driven).
 */
export const VoiceoverCueContext = createContext<SceneVoiceoverCue | null>(null);
export type { SceneVoiceoverCue };
