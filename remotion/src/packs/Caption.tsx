import { theme } from "../theme";

// Editorial caption pinned to the bottom of a scene.
export const Caption: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: theme.mono,
        fontSize: 38,
        fontStyle: "italic",
        color: theme.textDim,
        opacity,
        padding: "0 80px",
      }}
    >
      {text}
    </div>
  );
};
