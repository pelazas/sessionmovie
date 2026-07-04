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

export interface VoiceoverCue {
  /** Index into screenplay.scenes. */
  sceneIndex: number;
  /** Path relative to remotion/public/ — feed straight to staticFile(). */
  file: string;
  durationSec: number;
  /** The narrated text — what the caption displays word-by-word. */
  text: string;
  /** Absolute path of the cached character-timestamps sidecar (provenance/debug). */
  timestampsFile: string;
  /** Word timings precomputed from the sidecar; [] when alignment was absent. */
  words: WordTiming[];
}

export interface VoiceoverManifest {
  cues: VoiceoverCue[];
}

/**
 * A cue resolved into SCENE-LOCAL frames for the renderer — precomputed once
 * per scene (src/voiceover/sync.ts sceneLocalCue), looked up per frame.
 */
export interface SceneVoiceoverCue {
  /** Scene-local frame narration (and the caption) starts. */
  startFrame: number;
  /** Scene-local frame narration ends. */
  endFrame: number;
  words: Array<{ text: string; startFrame: number; endFrame: number }>;
}
