import type { Emotion } from "../screenplay";

/**
 * The puppet rig contract shared by both characters (docs/characters.md).
 *
 * Characters are SVG-as-code drawn on a common 200×240 skeleton so <Mascot>
 * pose presets are character-agnostic: both puppets place their pivots at the
 * same coordinates and expose the same named groups (#body, #head, #eyes,
 * #mouth, #arm-l, #arm-r, #accessory). Faces are 7 swappable groups mapping
 * 1:1 to the schema's Emotion enum — the enum bounds the art budget.
 */

export const RIG_VIEWBOX = "0 0 200 240";

/** Rotation pivots (SVG user units) shared by both characters. */
export const PIVOT = {
  armL: [50, 144],
  armR: [150, 144],
  head: [100, 122],
  body: [100, 232],
} as const;

/** SVG `transform` strings computed by <Mascot> and applied to rig groups. */
export interface RigTransforms {
  body?: string;
  head?: string;
  armL?: string;
  armR?: string;
}

export interface CharacterProps {
  emotion: Emotion;
  rig: RigTransforms;
  /** Cursor-blink beat, driven deterministically by <Mascot>. */
  blink?: boolean;
}

/** Emotions where a blink reads as alive rather than fighting the expression. */
export const BLINKABLE: ReadonlySet<Emotion> = new Set(["neutral", "confident", "smug"]);
