import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { BLINKABLE, type CharacterProps } from "./rig";

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
      <text
        x={140}
        y={74}
        fontFamily={theme.mono}
        fontWeight={700}
        fontSize={30}
        fill={theme.yellow}
      >
        ?
      </text>
    </>
  ),
  panicking: (
    <>
      <rect x={64} y={59} width={17} height={31} fill={theme.purple} />
      <rect x={117} y={59} width={17} height={31} fill={theme.purple} />
      {/* sweat drop, off the temple */}
      <path d="M156 58 q7 11 0 15 q-8 -4 0 -15" fill={theme.blue} />
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
  defeated: (
    <g stroke={theme.textDim} strokeWidth={6} strokeLinecap="round">
      <line x1={68} y1={66} x2={84} y2={84} />
      <line x1={84} y1={66} x2={68} y2={84} />
      <line x1={116} y1={66} x2={132} y2={84} />
      <line x1={132} y1={66} x2={116} y2={84} />
    </g>
  ),
  celebrating: (
    <g stroke={theme.purple} strokeWidth={7} strokeLinecap="round" fill="none">
      <path d="M66 82 L76 66 L86 82" />
      <path d="M114 82 L124 66 L134 82" />
    </g>
  ),
};

const MOUTHS: Record<Emotion, React.ReactNode> = {
  neutral: <line x1={88} y1={100} x2={112} y2={100} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />,
  confident: <path d="M84 95 Q100 107 116 95" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  confused: <path d="M84 100 l8 -6 l8 6 l8 -6 l8 6" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  panicking: <rect x={89} y={92} width={22} height={17} rx={8} fill={theme.bg} stroke={theme.text} strokeWidth={5} />,
  smug: <path d="M88 102 Q104 106 114 93" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  defeated: <path d="M84 106 Q100 94 116 106" stroke={theme.textDim} strokeWidth={5} fill="none" strokeLinecap="round" />,
  celebrating: <path d="M82 92 Q100 112 118 92" stroke={theme.text} strokeWidth={6} fill="none" strokeLinecap="round" />,
};

export const Agent: React.FC<CharacterProps> = ({ emotion, rig, blink }) => {
  const dimEyes = blink === true && BLINKABLE.has(emotion);
  return (
    <>
      {/* legs — static, outside the rig */}
      <rect x={72} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />
      <rect x={110} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />

      <g id="body" transform={rig.body}>
        <g id="arm-l" transform={rig.armL}>
          <rect x={28} y={136} width={22} height={56} rx={11} fill={theme.panelBorder} />
        </g>
        <g id="arm-r" transform={rig.armR}>
          <rect x={150} y={136} width={22} height={56} rx={11} fill={theme.panelBorder} />
        </g>
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

        <g id="head" transform={rig.head}>
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
          <g id="eyes" opacity={dimEyes ? 0.15 : 1}>
            {EYES[emotion]}
          </g>
          <g id="mouth">{MOUTHS[emotion]}</g>
        </g>
      </g>
    </>
  );
};
