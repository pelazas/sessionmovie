// The no-genre look (docs/visual-language.md): dark terminal canvas, ONE coral
// accent sampled from the Claude Code pixel mascot, warm off-white text.
// Semantic tokens only — no per-scene bespoke colors downstream. ok/fail are
// functional status colors (command pass/fail), not a second accent.
export const theme = {
  bg: "#0D1117",
  panel: "#161B22",
  panelBorder: "#2A2F3A",
  panelShadow: "0 18px 48px rgba(0,0,0,0.45)",
  radius: 20,

  // coral accent family (the mascot)
  accent: "#C96442",
  accentBright: "#E0805C",
  accentShade: "#A34D31",
  accentSoft: "rgba(201, 100, 66, 0.16)",
  ink: "#0B0B0D", // near-black: pixel eyes, stubby legs, pixel shading

  // functional status (command verdicts, diff +/-)
  ok: "#3FB950",
  okSoft: "rgba(63, 185, 80, 0.15)",
  fail: "#F85149",
  failSoft: "rgba(248, 81, 73, 0.15)",

  textPrimary: "#ECE7DF", // warm off-white
  textDim: "#9B958C",

  mono: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
} as const;
