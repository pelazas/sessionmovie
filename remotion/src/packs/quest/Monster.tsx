import { quest } from "./theme";

/**
 * The session's failures, personified: a flat geometric bug-blob the puppets
 * fight. Same SVG-as-code discipline as the characters (docs/characters.md):
 * theme tokens, no gradients, readable small. `hp` ∈ [0,1] drives the bar;
 * `wobble` is a caller-computed deterministic offset (sin of frame — never
 * Math.random in compositions).
 */
export const Monster: React.FC<{
  size?: number;
  hp: number;
  wobble?: number;
  defeated?: boolean;
}> = ({ size = 420, hp, wobble = 0, defeated = false }) => {
  const clampedHp = Math.max(0, Math.min(1, hp));
  return (
    <div style={{ width: size, position: "relative" }}>
      {/* HP bar */}
      <div
        style={{
          height: 26,
          borderRadius: 13,
          border: `3px solid ${quest.panelBorder}`,
          backgroundColor: quest.panel,
          overflow: "hidden",
          marginBottom: 18,
          opacity: defeated ? 0.35 : 1,
        }}
      >
        <div
          style={{
            width: `${clampedHp * 100}%`,
            height: "100%",
            backgroundColor: clampedHp > 0.4 ? quest.red : quest.goldBright,
          }}
        />
      </div>
      <svg
        viewBox="0 0 200 170"
        width={size}
        style={{
          transform: `translateY(${wobble}px) rotate(${defeated ? 74 : 0}deg)`,
          opacity: defeated ? 0.45 : 1,
        }}
      >
        {/* body blob */}
        <path
          d="M100 12 C150 12 182 52 182 96 C182 140 148 160 100 160 C52 160 18 140 18 96 C18 52 50 12 100 12"
          fill={quest.panel}
          stroke={quest.red}
          strokeWidth={5}
        />
        {/* horns */}
        <path d="M52 32 L38 6 L70 20 Z" fill={quest.red} />
        <path d="M148 32 L162 6 L130 20 Z" fill={quest.red} />
        {/* eyes: angry slits, or X-ed out when defeated */}
        {defeated ? (
          <g stroke={quest.textDim} strokeWidth={7} strokeLinecap="round">
            <line x1={58} y1={62} x2={86} y2={90} />
            <line x1={86} y1={62} x2={58} y2={90} />
            <line x1={114} y1={62} x2={142} y2={90} />
            <line x1={142} y1={62} x2={114} y2={90} />
          </g>
        ) : (
          <g>
            <path d="M54 68 L90 78 L54 88 Z" fill={quest.goldBright} />
            <path d="M146 68 L110 78 L146 88 Z" fill={quest.goldBright} />
          </g>
        )}
        {/* jagged mouth */}
        <path
          d={defeated ? "M64 124 Q100 108 136 124" : "M60 118 l12 10 l13 -10 l13 10 l13 -10 l13 10 l12 -10"}
          fill="none"
          stroke={defeated ? quest.textDim : quest.text}
          strokeWidth={6}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
