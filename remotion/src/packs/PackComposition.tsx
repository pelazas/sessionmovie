import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import type { Scene, Screenplay } from "../screenplay";
import { sceneFrames } from "../timing";
import type { GenrePack } from "./types";

/**
 * One composition body shared by every pack: audio layer + a Series of
 * scenes, each rendered by the pack's component for its scene type. The
 * composition's props ARE the screenplay — `--props=<screenplay.json>` (plus
 * the optional voiceover sidecar) is a valid input with no adapter layer.
 */
export const makePackComposition = (pack: GenrePack): React.FC<Screenplay> => {
  const SceneRenderer: React.FC<{
    scene: Scene;
    screenplay: Screenplay;
    durationInFrames: number;
  }> = ({ scene, screenplay, durationInFrames }) => {
    // The switch narrows the union; pack.components keeps packs interchangeable.
    switch (scene.type) {
      case "title":
        return <pack.components.title scene={scene} screenplay={screenplay} durationInFrames={durationInFrames} />;
      case "dialogue":
        return <pack.components.dialogue scene={scene} screenplay={screenplay} durationInFrames={durationInFrames} />;
      case "action":
        return <pack.components.action scene={scene} screenplay={screenplay} durationInFrames={durationInFrames} />;
      case "showcase":
        return <pack.components.showcase scene={scene} screenplay={screenplay} durationInFrames={durationInFrames} />;
      case "stats":
        return <pack.components.stats scene={scene} screenplay={screenplay} durationInFrames={durationInFrames} />;
    }
  };

  const PackComposition: React.FC<Screenplay> = (screenplay) => {
    const { fps } = useVideoConfig();
    return (
      <AbsoluteFill style={{ backgroundColor: pack.background }}>
        <pack.Audio screenplay={screenplay} />
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
  return PackComposition;
};
