import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { BLINKABLE, type CharacterProps } from "./rig";

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
      <line x1={74} y1={66} x2={94} y2={64} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
      <line x1={106} y1={64} x2={126} y2={66} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  confused: (
    <>
      <circle cx={84} cy={78} r={6} fill={theme.text} />
      <circle cx={116} cy={76} r={4} fill={theme.text} />
      {/* one raised brow */}
      <path d="M106 62 Q116 56 126 62" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />
      <text
        x={136}
        y={66}
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
      <circle cx={84} cy={78} r={9} fill="none" stroke={theme.text} strokeWidth={5} />
      <circle cx={116} cy={78} r={9} fill="none" stroke={theme.text} strokeWidth={5} />
      <path d="M146 62 q7 11 0 15 q-8 -4 0 -15" fill={theme.blue} />
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
  defeated: (
    <g stroke={theme.textDim} strokeWidth={5} strokeLinecap="round">
      <line x1={77} y1={71} x2={91} y2={85} />
      <line x1={91} y1={71} x2={77} y2={85} />
      <line x1={109} y1={71} x2={123} y2={85} />
      <line x1={123} y1={71} x2={109} y2={85} />
    </g>
  ),
  celebrating: (
    <g stroke={theme.text} strokeWidth={6} strokeLinecap="round" fill="none">
      <path d="M74 82 L84 70 L94 82" />
      <path d="M106 82 L116 70 L126 82" />
    </g>
  ),
};

const MOUTHS: Record<Emotion, React.ReactNode> = {
  neutral: <line x1={90} y1={100} x2={110} y2={100} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />,
  confident: <path d="M86 96 Q100 106 114 96" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  confused: <path d="M86 100 l7 -5 l7 5 l7 -5 l7 5" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  panicking: <ellipse cx={100} cy={100} rx={10} ry={8} fill={theme.bg} stroke={theme.text} strokeWidth={5} />,
  smug: <path d="M90 102 Q104 105 112 94" stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  defeated: <path d="M86 105 Q100 95 114 105" stroke={theme.textDim} strokeWidth={5} fill="none" strokeLinecap="round" />,
  celebrating: <path d="M85 94 Q100 111 115 94" stroke={theme.text} strokeWidth={6} fill="none" strokeLinecap="round" />,
};

export const User: React.FC<CharacterProps> = ({ emotion, rig, blink }) => {
  const dimEyes = blink === true && BLINKABLE.has(emotion);
  return (
    <>
      {/* legs — static, outside the rig */}
      <rect x={72} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />
      <rect x={110} y={202} width={18} height={32} rx={7} fill={theme.panelBorder} />

      <g id="body" transform={rig.body}>
        <g id="arm-l" transform={rig.armL}>
          <rect
            x={28}
            y={136}
            width={22}
            height={56}
            rx={11}
            fill={theme.panel}
            stroke={theme.blue}
            strokeWidth={4}
          />
        </g>
        <g id="arm-r" transform={rig.armR}>
          <rect
            x={150}
            y={136}
            width={22}
            height={56}
            rx={11}
            fill={theme.panel}
            stroke={theme.blue}
            strokeWidth={4}
          />
        </g>
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

        <g id="head" transform={rig.head}>
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
          <g id="eyes" opacity={dimEyes ? 0.15 : 1}>
            {EYES[emotion]}
          </g>
          <g id="mouth">{MOUTHS[emotion]}</g>
        </g>
      </g>
    </>
  );
};
