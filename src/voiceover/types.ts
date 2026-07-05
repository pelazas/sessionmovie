/**
 * Voiceover manifest types — a LEAF module (no imports) so the renderer can
 * type-only import it without dragging CLI/node code into remotion's
 * typecheck. Single source of truth; never re-declare these shapes.
 *
 * The manifest is a renderer-side sidecar in the composition input props;
 * the frozen screenplay IR is untouched (docs/audio.md).
 */
/**
 * Character-level alignment as returned by ElevenLabs' with-timestamps
 * endpoint — three parallel arrays. Cached verbatim as the .timestamps.json
 * sidecar next to the mp3 (same content-addressed key).
 */
export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** One spoken word with measured audio-relative timing (seconds). */
export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

/** One dialogue line's narration (PR-H: per-line, not per-scene). */
export interface VoiceoverLineCue {
  sceneIndex: number;
  lineIndex: number;
  speaker: "user" | "claude";
  text: string;
  /** Path relative to remotion/public/ — feed straight to staticFile(). */
  file: string;
  durationSec: number;
  /** Public-relative like `file` — absolute host paths would embed the local
   * username in shareable props sidecars and break cross-machine reproducibility. */
  timestampsFile: string;
  /** Word timings precomputed from the sidecar; [] when alignment was absent. */
  words: WordTiming[];
}

export interface VoiceoverManifest {
  lineCues: VoiceoverLineCue[];
}

/**
 * A line cue resolved into SCENE-LOCAL frames for the renderer — precomputed
 * once per scene (remotion/src/packs/voiceoverSync.ts sceneLocalTrack).
 */
export interface SceneVoiceoverLineCue {
  lineIndex: number;
  /** Scene-local frame this line's narration (and bubble) starts. */
  startFrame: number;
  /** Scene-local frame this line's narration ends. */
  endFrame: number;
  words: Array<{ text: string; startFrame: number; endFrame: number }>;
}
