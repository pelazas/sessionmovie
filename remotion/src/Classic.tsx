import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import type { Scene, Screenplay } from "./screenplay/types";
import { theme } from "./theme";
import { Title } from "./scenes/Title";
import { Action } from "./scenes/Action";
import { Showcase } from "./scenes/Showcase";
import { Stats } from "./scenes/Stats";

export const sceneFrames = (scene: Scene, fps: number): number =>
  Math.max(1, Math.round(scene.targetSec * fps));

export const totalFrames = (screenplay: Screenplay, fps: number): number =>
  screenplay.scenes.reduce((sum, s) => sum + sceneFrames(s, fps), 0);

const SceneRenderer: React.FC<{
  scene: Scene;
  screenplay: Screenplay;
  durationInFrames: number;
}> = ({ scene, screenplay, durationInFrames }) => {
  switch (scene.type) {
    case "title":
      return (
        <Title scene={scene} caption={scene.caption} repo={screenplay.sessionMeta.repo} />
      );
    case "action":
      return <Action scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "showcase":
      return <Showcase scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "stats":
      return <Stats scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "dialogue":
      // TODO: classic must render every scene type before v1
      // (docs/architecture.md); bare placeholder until the dialogue scene
      // with character sprites exists.
      return (
        <AbsoluteFill
          style={{
            backgroundColor: theme.bg,
            justifyContent: "center",
            alignItems: "center",
            fontFamily: theme.mono,
            gap: 30,
            padding: 80,
          }}
        >
          {scene.lines.map((line, i) => (
            <div key={i} style={{ fontSize: 40, color: line.speaker === "user" ? theme.blue : theme.purple }}>
              {line.speaker} ({line.emotion}): {line.text}
            </div>
          ))}
        </AbsoluteFill>
      );
  }
};

export const Classic: React.FC<{ screenplay: Screenplay }> = ({ screenplay }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Series>
        {screenplay.scenes.map((scene, i) => {
          const frames = sceneFrames(scene, fps);
          return (
            <Series.Sequence key={i} durationInFrames={frames}>
              <SceneRenderer
                scene={scene}
                screenplay={screenplay}
                durationInFrames={frames}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
