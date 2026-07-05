import type { CSSProperties, ReactNode } from "react";
import { theme } from "../theme";

export type PanelVariant = "code" | "terminal" | "tree" | "stat";

/** The single panel chrome (docs/visual-language.md): code window / terminal /
 *  file tree / stat card are this component with different content + title.
 *  Scenes drive the entrance via `style` (transform/opacity from motion.ts). */
export const Panel: React.FC<{
  variant?: PanelVariant;
  title?: string;
  accent?: string;
  trafficDots?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}> = ({ variant = "code", title, accent = theme.accent, trafficDots, children, style, bodyStyle }) => {
  const showDots = trafficDots ?? (variant === "code" || variant === "terminal");
  const showBar = title !== undefined || showDots;
  return (
    <div style={{ backgroundColor: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: theme.radius, boxShadow: theme.panelShadow, overflow: "hidden", fontFamily: theme.mono, ...style }}>
      {showBar && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 28px", borderBottom: `2px solid ${theme.panelBorder}`, borderTop: `3px solid ${accent}` }}>
          {showDots && [theme.fail, theme.accent, theme.ok].map((c, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c }} />
          ))}
          {title !== undefined && <span style={{ color: theme.textDim, fontSize: 28, marginLeft: showDots ? 10 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>}
        </div>
      )}
      <div style={{ padding: 40, ...bodyStyle }}>{children}</div>
    </div>
  );
};
