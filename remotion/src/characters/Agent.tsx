import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { CaretEyes, CrossEyes, QuestionMark, SweatDrop, makeMouths } from "./FaceParts";
import { PuppetFrame, type CharacterProps, type PuppetArt } from "./rig";

/**
 * The agent mascot: a terminal-faced robot with cursor-blink eyes.
 * Original design, deliberately — NOT the Claude logo or starburst
 * (trademarks; see docs/characters.md). Flat geometric shapes, theme
 * tokens only, bold enough to read at 120px.
 */

// Cursor eyes: purple blocks, like block cursors in the head's terminal screen.
const EYES: Record<Emotion, React.ReactNode> = {
  neutral: (
    <>
      <rect x={70} y={64} width={12} height={26} fill={theme.purple} />
      <rect x={118} y={64} width={12} height={26} fill={theme.purple} />
    </>
  ),
  confident: (
    <>
      <rect x={70} y={62} width={12} height={28} fill={theme.purple} />
      <rect x={118} y={62} width={12} height={28} fill={theme.purple} />
    </>
  ),
  confused: (
    <>
      <rect x={70} y={64} width={12} height={26} fill={theme.purple} transform="rotate(16 76 77)" />
      <rect x={118} y={74} width={12} height={16} fill={theme.purple} />
      <QuestionMark x={140} y={74} />
    </>
  ),
  panicking: (
    <>
      <rect x={64} y={59} width={17} height={31} fill={theme.purple} />
      <rect x={117} y={59} width={17} height={31} fill={theme.purple} />
      <SweatDrop x={156} y={58} />
    </>
  ),
  smug: (
    <>
      <rect x={66} y={68} width={20} height={6} fill={theme.purple} />
      <rect x={70} y={74} width={12} height={14} fill={theme.purple} />
      <rect x={114} y={68} width={20} height={6} fill={theme.purple} />
      <rect x={118} y={74} width={12} height={14} fill={theme.purple} />
    </>
  ),
  defeated: <CrossEyes cxL={76} cxR={124} cy={75} halfX={8} halfY={9} strokeWidth={6} />,
  celebrating: (
    <CaretEyes
      cxL={76}
      cxR={124}
      baseY={82}
      tipY={66}
      halfW={10}
      strokeWidth={7}
      stroke={theme.purple}
    />
  ),
};

const MOUTHS = makeMouths({
  neutral: { x1: 88, x2: 112, y: 100 },
  confident: "M84 95 Q100 107 116 95",
  confused: "M84 100 l8 -6 l8 6 l8 -6 l8 6",
  panicking: (
    <rect x={89} y={92} width={22} height={17} rx={8} fill={theme.bg} stroke={theme.text} strokeWidth={5} />
  ),
  smug: "M88 102 Q104 106 114 93",
  defeated: "M84 106 Q100 94 116 106",
  celebrating: "M82 92 Q100 112 118 92",
});

const ART: PuppetArt = {
  armL: <rect x={28} y={136} width={22} height={56} rx={11} fill={theme.panelBorder} />,
  armR: <rect x={150} y={136} width={22} height={56} rx={11} fill={theme.panelBorder} />,
  torso: (
    <>
      <rect
        x={58}
        y={126}
        width={84}
        height={80}
        rx={16}
        fill={theme.panel}
        stroke={theme.panelBorder}
        strokeWidth={4}
      />
      {/* chest status light */}
      <circle cx={100} cy={168} r={9} fill={theme.green} />
    </>
  ),
  head: (
    <>
      <rect x={92} y={116} width={16} height={14} fill={theme.panelBorder} />
      <g id="accessory">
        <line x1={100} y1={28} x2={100} y2={12} stroke={theme.panelBorder} strokeWidth={5} />
        <circle cx={100} cy={9} r={7} fill={theme.purple} />
      </g>
      {/* terminal-window head */}
      <rect
        x={40}
        y={28}
        width={120}
        height={92}
        rx={14}
        fill={theme.panel}
        stroke={theme.panelBorder}
        strokeWidth={4}
      />
      {/* title bar with traffic lights */}
      <line x1={42} y1={50} x2={158} y2={50} stroke={theme.panelBorder} strokeWidth={3} />
      <circle cx={58} cy={40} r={5} fill={theme.red} />
      <circle cx={74} cy={40} r={5} fill={theme.yellow} />
      <circle cx={90} cy={40} r={5} fill={theme.green} />
      {/* screen the face lives on */}
      <rect x={48} y={56} width={104} height={58} rx={8} fill={theme.bg} />
    </>
  ),
  eyes: EYES,
  mouths: MOUTHS,
};

export const Agent: React.FC<CharacterProps> = (props) => <PuppetFrame {...props} art={ART} />;
