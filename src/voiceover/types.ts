/**
 * Voiceover manifest types — a LEAF module (no imports) so the renderer can
 * type-only import it without dragging CLI/node code into remotion's
 * typecheck. Single source of truth; never re-declare these shapes.
 *
 * The manifest is a renderer-side sidecar in the composition input props;
 * the frozen screenplay IR is untouched (docs/audio.md).
 */
export interface VoiceoverCue {
  /** Index into screenplay.scenes. */
  sceneIndex: number;
  /** Path relative to remotion/public/ — feed straight to staticFile(). */
  file: string;
  durationSec: number;
}

export interface VoiceoverManifest {
  cues: VoiceoverCue[];
}
