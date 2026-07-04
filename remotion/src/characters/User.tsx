import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { CaretEyes, CrossEyes, QuestionMark, SweatDrop, makeMouths } from "./FaceParts";
import { PuppetFrame, type CharacterProps, type PuppetArt } from "./rig";

/**
 * The user avatar: a generic hoodie dev with headphones. Same 200×240 rig
 * skeleton and pivots as the agent, so <Mascot> poses apply unchanged.
 * Flat geometric shapes, theme tokens only (blue accent — the user's
 * dialogue color), bold enough to read at 120px.
 */

const EYES: Record<Emotion, React.ReactNode> = {
  neutral: (
    <>
      <circle cx={84} cy={78} r={6} fill={theme.text} />
      <circle cx={116} cy={78} r={6} fill={theme.text} />
    </>
  ),
  confident: (
    <>
      <circle cx={84} cy={78} r={6} fill={theme.text} />
      <circle cx={116} cy={78} r={6} fill={theme.text} />
      <line x1={76} y1={69} x2={92} y2={67} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
      <line x1={108} y1={67} x2={124} y2={69} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  confused: (
    <>
      <circle cx={84} cy={78} r={6} fill={theme.text} />
      <circle cx={116} cy={76} r={4} fill={theme.text} />
      {/* one raised brow */}
      <path d="M106 68 Q116 62 126 68" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />
      <QuestionMark x={136} y={66} />
    </>
  ),
  panicking: (
    <>
      <circle cx={84} cy={78} r={9} fill="none" stroke={theme.text} strokeWidth={5} />
      <circle cx={116} cy={78} r={9} fill="none" stroke={theme.text} strokeWidth={5} />
      <SweatDrop x={146} y={62} />
    </>
  ),
  smug: (
    <>
      <line x1={76} y1={74} x2={92} y2={74} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
      <circle cx={84} cy={80} r={5} fill={theme.text} />
      <line x1={108} y1={74} x2={124} y2={74} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
      <circle cx={116} cy={80} r={5} fill={theme.text} />
    </>
  ),
  defeated: <CrossEyes cxL={84} cxR={116} cy={78} halfX={7} halfY={7} strokeWidth={5} />,
  celebrating: (
    <CaretEyes
      cxL={84}
      cxR={116}
      baseY={82}
      tipY={70}
      halfW={10}
      strokeWidth={6}
      stroke={theme.text}
    />
  ),
};

const MOUTHS = makeMouths({
  neutral: { x1: 90, x2: 110, y: 100 },
  confident: "M86 96 Q100 106 114 96",
  confused: "M86 100 l7 -5 l7 5 l7 -5 l7 5",
  panicking: (
    <ellipse cx={100} cy={100} rx={10} ry={8} fill={theme.bg} stroke={theme.text} strokeWidth={5} />
  ),
  smug: "M90 102 Q104 105 112 94",
  defeated: "M86 105 Q100 95 114 105",
  celebrating: "M85 94 Q100 111 115 94",
});

const ART: PuppetArt = {
  armL: (
    <rect x={28} y={136} width={22} height={56} rx={11} fill={theme.panel} stroke={theme.blue} strokeWidth={4} />
  ),
  armR: (
    <rect x={150} y={136} width={22} height={56} rx={11} fill={theme.panel} stroke={theme.blue} strokeWidth={4} />
  ),
  torso: (
    <>
      {/* hoodie torso */}
      <rect
        x={56}
        y={126}
        width={88}
        height={80}
        rx={20}
        fill={theme.panel}
        stroke={theme.blue}
        strokeWidth={4}
      />
      {/* kangaroo pocket + drawstrings */}
      <path
        d="M80 178 h40 v14 a8 8 0 0 1 -8 8 h-24 a8 8 0 0 1 -8 -8 z"
        fill="none"
        stroke={theme.blue}
        strokeWidth={4}
      />
      <line x1={92} y1={130} x2={92} y2={150} stroke={theme.blue} strokeWidth={4} strokeLinecap="round" />
      <line x1={108} y1={130} x2={108} y2={150} stroke={theme.blue} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  head: (
    <>
      {/* hood ring */}
      <circle cx={100} cy={78} r={52} fill={theme.panel} stroke={theme.blue} strokeWidth={5} />
      {/* face */}
      <circle cx={100} cy={80} r={38} fill={theme.bg} stroke={theme.panelBorder} strokeWidth={3} />
      {/* hair fringe */}
      <path d="M66 68 A38 38 0 0 1 134 68 Q118 58 100 60 Q82 58 66 68" fill={theme.textDim} />
      <g id="accessory">
        {/* headphones over the hood */}
        <path d="M52 66 A48 48 0 0 1 148 66" fill="none" stroke={theme.panelBorder} strokeWidth={7} />
        <rect x={42} y={62} width={14} height={26} rx={6} fill={theme.panelBorder} />
        <rect x={144} y={62} width={14} height={26} rx={6} fill={theme.panelBorder} />
      </g>
    </>
  ),
  eyes: EYES,
  mouths: MOUTHS,
};

export const User: React.FC<CharacterProps> = (props) => <PuppetFrame {...props} art={ART} />;
