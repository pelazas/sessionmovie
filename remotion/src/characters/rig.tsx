import type { Emotion } from "../screenplay";
import { theme } from "../theme";

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

/**
 * The Emotion enum as a value, in schema order — for iteration (ContactSheet
 * columns). `satisfies` rejects extras/typos; the check below stops compiling
 * if the enum gains a member this list doesn't have — a schema change can't
 * silently drop a contact-sheet column (issue #13).
 */
export const EMOTIONS = [
  "neutral",
  "confident",
  "confused",
  "panicking",
  "smug",
  "defeated",
  "celebrating",
] as const satisfies readonly Emotion[];

type MissingEmotion = Exclude<Emotion, (typeof EMOTIONS)[number]>;
const _emotionsExhaustive: MissingEmotion extends never ? true : { missing: MissingEmotion } =
  true;
void _emotionsExhaustive;

/** Per-character art slotted into the shared skeleton. */
export interface PuppetArt {
  /** Contents of #arm-l / #arm-r (drawn at rest; rig transforms rotate them). */
  armL: React.ReactNode;
  armR: React.ReactNode;
  /** Torso plus anything anchored to it (chest light, pocket, drawstrings). */
  torso: React.ReactNode;
  /** Everything inside #head that isn't the face: neck, accessory, plates. */
  head: React.ReactNode;
  eyes: Record<Emotion, React.ReactNode>;
  mouths: Record<Emotion, React.ReactNode>;
}

/**
 * The shared skeleton (issue #13): group nesting, static legs, and blink-dim
 * logic were byte-identical in both characters — they live here once, and
 * characters shrink to art.
 */
export const PuppetFrame: React.FC<CharacterProps & { art: PuppetArt }> = ({
  emotion,
  rig,
  blink,
  art,
}) => {
  const dimEyes = blink === true && BLINKABLE.has(emotion);
  return (
    <>
      {/* legs — static, outside the rig */}
      <rect x={72} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />
      <rect x={110} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />

      <g id="body" transform={rig.body}>
        <g id="arm-l" transform={rig.armL}>
          {art.armL}
        </g>
        <g id="arm-r" transform={rig.armR}>
          {art.armR}
        </g>
        {art.torso}

        <g id="head" transform={rig.head}>
          {art.head}
          <g id="eyes" opacity={dimEyes ? 0.15 : 1}>
            {art.eyes[emotion]}
          </g>
          <g id="mouth">{art.mouths[emotion]}</g>
        </g>
      </g>
    </>
  );
};
