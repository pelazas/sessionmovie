import type { Emotion } from "../screenplay";
import type { CharacterArt } from "./rig";
import type { UserIdentity } from "./identity";

const EMPTY: Record<Emotion, React.ReactNode> = {
  neutral: null, confident: null, confused: null, panicking: null, smug: null, defeated: null, celebrating: null,
};

/** Same rig as the agent, tinted with the avatar's dominant color; #head is a
 * pixelated raster of the user's GitHub avatar (or a default drawn head). */
export const makeUserArt = (id: UserIdentity): CharacterArt => ({
  head: (
    <>
      <rect x={44} y={26} width={112} height={122} rx={20} fill={id.bodyTint} />
      {id.headDataUri
        ? <image href={id.headDataUri} x={52} y={34} width={96} height={96}
            preserveAspectRatio="xMidYMid slice" imageRendering="pixelated" />
        : <>
            <rect x={76} y={74} width={14} height={36} rx={2} fill="rgba(0,0,0,0.55)" />
            <rect x={110} y={74} width={14} height={36} rx={2} fill="rgba(0,0,0,0.55)" />
          </>}
    </>
  ),
  torso: (
    <>
      <rect x={66} y={150} width={68} height={48} rx={14} fill={id.bodyTint} />
      <rect x={66} y={178} width={68} height={20} rx={10} fill="rgba(0,0,0,0.18)" />
    </>
  ),
  armL: <rect x={46} y={154} width={18} height={34} rx={9} fill={id.bodyTint} />,
  armR: <rect x={136} y={154} width={18} height={34} rx={9} fill={id.bodyTint} />,
  legs: (
    <>
      <rect x={80} y={198} width={14} height={20} rx={4} fill="rgba(0,0,0,0.55)" />
      <rect x={106} y={198} width={14} height={20} rx={4} fill="rgba(0,0,0,0.55)" />
    </>
  ),
  eyes: EMPTY,
  mouth: EMPTY,
});
