import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import type { CharacterArt } from "./rig";

/** Two tall vertical black rect eyes; emotion = height/position/tilt changes. */
const eye = (cx: number, y: number, w: number, h: number, tilt = 0): React.ReactNode => (
  <rect x={cx - w / 2} y={y} width={w} height={h} rx={2} fill={theme.ink}
    transform={tilt ? `rotate(${tilt} ${cx} ${y + h / 2})` : undefined} />
);
const L = 82, R = 118;

const EYES: Record<Emotion, React.ReactNode> = {
  neutral: <>{eye(L, 72, 15, 40)}{eye(R, 72, 15, 40)}</>,
  confident: <>{eye(L, 74, 15, 34)}{eye(R, 74, 15, 34)}</>,
  confused: <>{eye(L, 72, 15, 40, -12)}{eye(R, 78, 13, 30)}</>,
  panicking: <>{eye(L, 66, 19, 50)}{eye(R, 66, 19, 50)}</>,
  smug: <>{eye(L, 90, 15, 20)}{eye(R, 90, 15, 20)}</>,
  defeated: <>{eye(L, 86, 15, 16)}{eye(R, 86, 15, 16)}</>,
  celebrating: <>{eye(L, 74, 15, 30)}{eye(R, 74, 15, 30)}</>,
};

// Eyes-forward mascot: mouth used sparingly (null for most emotions).
const MOUTH: Record<Emotion, React.ReactNode> = {
  neutral: null, confident: null, smug: null,
  confused: <rect x={92} y={126} width={16} height={5} fill={theme.ink} transform="rotate(-6 100 128)" />,
  panicking: <rect x={90} y={122} width={20} height={16} rx={5} fill={theme.ink} />,
  defeated: <rect x={88} y={128} width={24} height={5} rx={2} fill={theme.ink} />,
  celebrating: <path d="M88 122 q12 16 24 0 z" fill={theme.ink} />,
};

export const CLAUDE_ART: CharacterArt = {
  head: (
    <>
      <rect x={96} y={12} width={8} height={14} fill={theme.accentShade} /> {/* cursor tick */}
      <rect x={44} y={26} width={112} height={122} rx={20} fill={theme.accent} />
      <rect x={44} y={128} width={112} height={20} rx={20} fill={theme.accentShade} opacity={0.5} />
    </>
  ),
  torso: <rect x={66} y={150} width={68} height={48} rx={14} fill={theme.accentShade} />,
  armL: <rect x={46} y={154} width={18} height={34} rx={9} fill={theme.accent} />,
  armR: <rect x={136} y={154} width={18} height={34} rx={9} fill={theme.accent} />,
  legs: (
    <>
      <rect x={80} y={198} width={14} height={20} rx={4} fill={theme.ink} />
      <rect x={106} y={198} width={14} height={20} rx={4} fill={theme.ink} />
    </>
  ),
  eyes: EYES,
  mouth: MOUTH,
};
