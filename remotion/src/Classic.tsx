import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import type { Scene, Screenplay } from "./screenplay";
import { theme } from "./theme";
import { Title } from "./scenes/Title";
import { Dialogue } from "./scenes/Dialogue";
import { Action } from "./scenes/Action";
import { Showcase } from "./scenes/Showcase";
import { Stats } from "./scenes/Stats";

export const sceneFrames = (scene: Scene, fps: number): number =>
  Math.max(1, Math.round(scene.targetSec * fps));

export const totalFrames = (screenplay: Screenplay, fps: number): number =>
  screenplay.scenes.reduce((sum, s) => sum + sceneFrames(s, fps), 0);

// One component per scene type — this switch is the single seam that becomes
// GenrePack.components: Record<SceneType, FC> when genre #2 is extracted.
const SceneRenderer: React.FC<{
  scene: Scene;
  screenplay: Screenplay;
  durationInFrames: number;
}> = ({ scene, screenplay, durationInFrames }) => {
  switch (scene.type) {
    case "title":
      return (
        <Title
          scene={scene}
          caption={scene.caption}
          repo={screenplay.sessionMeta.repo}
          durationInFrames={durationInFrames}
        />
      );
    case "dialogue":
      return <Dialogue scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "action":
      return <Action scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "showcase":
      return <Showcase scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
    case "stats":
      return <Stats scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />;
  }
};

// The composition's props ARE the screenplay — so `--props=<screenplay.json>`
// (the parse CLI's output, unwrapped) is a valid input with no adapter layer.
export const Classic: React.FC<Screenplay> = (screenplay) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Series>
        {screenplay.scenes.map((scene, i) => {
          const frames = sceneFrames(scene, fps);
          return (
            <Series.Sequence key={i} durationInFrames={frames}>
              <SceneRenderer scene={scene} screenplay={screenplay} durationInFrames={frames} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
