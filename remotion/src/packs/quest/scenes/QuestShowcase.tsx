import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { CornerMascot } from "../../../characters/CornerMascot";
import { EASE_BACK_OUT, EASE_OUT } from "../../../easing";
import type { ShowcaseScene } from "../../../screenplay";
import { showcaseSchedule } from "../../../timing";
import { Caption } from "../../Caption";
import { Monster } from "../Monster";
import { quest } from "../theme";
import { AbstractDiff } from "../../classic/scenes/Showcase";

/**
 * The confrontation: the artifact is the battle record. verdict=fail → the
 * boss lands a hit (the real red output IS the attack); pass → boss
 * defeated; reveal → rare loot found. The verdict beat comes from the
 * shared schedule, so the classic SFX set lands on the same frame.
 */
const VERDICT: Record<
  ShowcaseScene["verdict"],
  { color: string; label: string; sub: string }
> = {
  fail: { color: quest.red, label: "💥 THE BOSS STRIKES", sub: "the party takes damage" },
  pass: { color: quest.goldBright, label: "⚔ BOSS DEFEATED", sub: "victory!" },
  reveal: { color: quest.parchment, label: "✦ RARE LOOT FOUND", sub: "inspect your prize" },
};

export const QuestShowcase: React.FC<{
  scene: ShowcaseScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { verdictStart, testRun, captionIn: captionInStart } = showcaseSchedule(durationInFrames);
  const verdict = VERDICT[scene.verdict];

  const panelIn = interpolate(frame, [0, 15], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const verdictIn = interpolate(frame, [verdictStart, verdictStart + 14], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionOpacity = interpolate(frame, [captionInStart, captionInStart + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // On fail the whole battlefield shakes when the hit lands (deterministic decay).
  const shake =
    scene.verdict === "fail" && frame >= verdictStart && frame < verdictStart + 14
      ? Math.sin((frame - verdictStart) * 2.4) * (14 - (frame - verdictStart))
      : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: quest.bg,
        fontFamily: quest.mono,
        justifyContent: "center",
        padding: 50,
        transform: `translateX(${shake}px)`,
      }}
    >
      {/* the boss looms over the record of what it did */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
        <Monster
          size={300}
          hp={scene.verdict === "pass" ? 0 : scene.verdict === "fail" ? 0.8 : 0.4}
          wobble={Math.sin(frame * 0.12) * 5}
          defeated={scene.verdict === "pass" && verdictIn > 0}
        />
      </div>

      {/* battle record — the real artifact, redacted upstream */}
      <div
        style={{
          backgroundColor: quest.panel,
          border: `3px solid ${verdictIn > 0 ? verdict.color : quest.panelBorder}`,
          borderRadius: 12,
          overflow: "hidden",
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 60}px)`,
        }}
      >
        <div
          style={{
            padding: "20px 36px",
            borderBottom: `2px solid ${quest.panelBorder}`,
            color: quest.textDim,
            fontSize: 30,
          }}
        >
          📜 battle record
        </div>
        {scene.artifact.kind === "diff" ? (
          <div style={{ padding: "32px 40px" }}>
            <div style={{ display: "flex", fontSize: 34, marginBottom: 20 }}>
              <span style={{ color: quest.parchment }}>{scene.artifact.file}</span>
              <span style={{ marginLeft: "auto" }}>
                <span style={{ color: quest.green }}>+{scene.artifact.added}</span>{" "}
                <span style={{ color: quest.red }}>−{scene.artifact.removed}</span>
              </span>
            </div>
            {(scene.artifact.snippet ?? "").trim().length === 0 ? (
              // Snippetless diffs are schema-legal (LLM screenwriters often
              // omit one) — reuse classic's abstract diff bars over dead space.
              <AbstractDiff
                added={scene.artifact.added}
                removed={scene.artifact.removed}
                durationInFrames={durationInFrames}
              />
            ) : null}
            {(scene.artifact.snippet ?? "")
              .split("\n")
              .filter((l) => l.length > 0)
              .slice(0, 8)
              .map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 28,
                    lineHeight: 1.7,
                    whiteSpace: "pre",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: line.startsWith("+")
                      ? quest.green
                      : line.startsWith("-")
                        ? quest.red
                        : quest.textDim,
                  }}
                >
                  {line}
                </div>
              ))}
          </div>
        ) : scene.artifact.kind === "testRun" ? (
          <div style={{ padding: "36px 40px" }}>
            <div style={{ color: quest.textDim, fontSize: 32, marginBottom: 24 }}>
              <span style={{ color: quest.gold }}>❯ </span>
              {scene.artifact.command.slice(
                0,
                Math.floor(
                  Math.max(0, frame - testRun.typeStart) *
                    (scene.artifact.command.length / (testRun.typeEnd - testRun.typeStart)),
                ),
              )}
            </div>
            {scene.artifact.summary ? (
              <div style={{ color: quest.textDim, fontSize: 32, marginBottom: 28 }}>
                {scene.artifact.summary}
              </div>
            ) : null}
            <div
              style={{
                display: "inline-block",
                padding: "14px 36px",
                borderRadius: 10,
                border: `3px solid ${scene.artifact.exitCode === 0 ? quest.green : quest.red}`,
                color: scene.artifact.exitCode === 0 ? quest.green : quest.red,
                fontSize: 44,
                fontWeight: 700,
                opacity: interpolate(frame, [testRun.badgeStart, testRun.badgeStart + 12], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {scene.artifact.exitCode === 0 ? "the blow lands" : `the party reels (exit ${scene.artifact.exitCode})`}
            </div>
          </div>
        ) : (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 100, marginBottom: 20 }}>🗺️</div>
            <div style={{ color: quest.text, fontSize: 36 }}>
              {scene.artifact.path.split("/").pop() ?? scene.artifact.path}
            </div>
          </div>
        )}
      </div>

      {/* the verdict banner */}
      <div
        style={{
          alignSelf: "center",
          marginTop: 52,
          padding: "24px 64px",
          borderRadius: 12,
          border: `3px solid ${verdict.color}`,
          backgroundColor: quest.panel,
          color: verdict.color,
          fontSize: 52,
          fontWeight: 700,
          textAlign: "center",
          opacity: verdictIn,
          transform: `scale(${verdictIn === 0 ? 0.5 : 0.5 + verdictIn * 0.5})`,
        }}
      >
        {verdict.label}
        <div style={{ fontSize: 28, color: quest.textDim, marginTop: 8 }}>{verdict.sub}</div>
      </div>

      <Sequence from={verdictStart} layout="none">
        {scene.verdict === "fail" ? (
          <CornerMascot pose="collapse" emotion="defeated" corner="bottom-left" seed="quest-fail" />
        ) : scene.verdict === "pass" ? (
          <CornerMascot pose="cheer" emotion="celebrating" corner="bottom-left" confetti seed="quest-pass" />
        ) : (
          <CornerMascot pose="point" emotion="smug" corner="bottom-left" seed="quest-reveal" />
        )}
      </Sequence>
      {caption ? <Caption text={caption} opacity={captionOpacity} /> : null}
    </AbsoluteFill>
  );
};
