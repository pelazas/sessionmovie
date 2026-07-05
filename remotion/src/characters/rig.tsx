import type { Emotion } from "../screenplay";

/** Shared puppet skeleton on a 200x240 grid (docs/characters.md). Both
 * characters place the same groups at the same pivots; the agent draws a coral
 * head, the user's #head is a raster <image>. */
export const RIG_VIEWBOX = "0 0 200 240";

export const PIVOT = {
  body: [100, 214], // feet — whole-body lean/bob
  head: [100, 150], // neck
  armL: [56, 158],
  armR: [144, 158],
  legs: [100, 198],
} as const;

export interface RigTransforms { body?: string; head?: string; armL?: string; armR?: string; legs?: string; }

export interface CharacterArt {
  torso: React.ReactNode;
  head: React.ReactNode;                    // coral plate (claude) OR raster (user)
  eyes: Record<Emotion, React.ReactNode>;   // user: all null
  mouth: Record<Emotion, React.ReactNode>;  // user: all null
  armL: React.ReactNode;
  armR: React.ReactNode;
  legs: React.ReactNode;
}

export const BLINKABLE: ReadonlySet<Emotion> = new Set(["neutral", "confident", "smug"]);

export const EMOTIONS = ["neutral", "confident", "confused", "panicking", "smug", "defeated", "celebrating"] as const satisfies readonly Emotion[];
type Missing = Exclude<Emotion, (typeof EMOTIONS)[number]>;
const _ex: Missing extends never ? true : { missing: Missing } = true; void _ex;

export const PuppetFrame: React.FC<{ emotion: Emotion; rig: RigTransforms; blink?: boolean; art: CharacterArt }> = ({ emotion, rig, blink, art }) => {
  const dim = blink === true && BLINKABLE.has(emotion);
  return (
    <>
      <g id="legs" transform={rig.legs}>{art.legs}</g>
      <g id="body" transform={rig.body}>
        <g id="arm-l" transform={rig.armL}>{art.armL}</g>
        <g id="arm-r" transform={rig.armR}>{art.armR}</g>
        {art.torso}
        <g id="head" transform={rig.head}>
          {art.head}
          <g id="eyes" opacity={dim ? 0.15 : 1}>{art.eyes[emotion]}</g>
          <g id="mouth">{art.mouth[emotion]}</g>
        </g>
      </g>
    </>
  );
};
