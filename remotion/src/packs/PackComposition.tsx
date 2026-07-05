import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from "remotion";
import type { FactTile } from "../../../src/facts/types";
import type { UserIdentity } from "../../../src/identity/types";
import type { VoiceoverManifest } from "../../../src/voiceover/types";
import { SceneTimeContext } from "./ClockChip";
import { FactTilesContext } from "./FactTiles";
import { sceneLocalCue } from "./voiceoverSync";
import type { Scene, Screenplay } from "../screenplay";
import { flash } from "../effects";
import { sceneCutFrames, sceneFrames } from "../timing";
import { VoiceoverCueContext, type GenrePack } from "./types";

/** Stable default so a missing sidecar never churns the context value. */
const EMPTY_TILES: FactTile[] = [];

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

  // ── scene-transitions block (feat/effects) ────────────────────────────────
  // A 4-frame flash/whip at every scene handoff, per-pack flavored: classic
  // is a cold shutter, quest a torch flicker. Cut FRAMES come from the shared
  // sceneCutFrames (beat-aligned upstream by the CLI quantizer) — no timing
  // logic of our own. The whoosh SFX cue in audio/events.ts fires at the
  // same frames.
  const CutTransitions: React.FC<{ screenplay: Screenplay }> = ({ screenplay }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    let opacity = 0;
    for (const cut of sceneCutFrames(screenplay, fps)) {
      // Peak ON the boundary frame: the veil covers the content swap instead of
      // decaying to half by the time the scenes actually switch.
      opacity = Math.max(opacity, flash(frame, cut, 4));
    }
    if (opacity === 0) return null;
    const torch = pack.id === "quest";
    // Torch flicker: deterministic frame-sine shimmer; shutter: clean decay.
    const flicker = torch ? 0.75 + 0.25 * Math.sin(frame * 2.1) : 1;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: torch ? "#ff8c42" : "#dfe7f0",
          opacity: opacity * (torch ? 0.8 : 0.85) * flicker,
          pointerEvents: "none",
        }}
      />
    );
  };
  // ── end scene-transitions block ────────────────────────────────────────────

  const PackComposition: React.FC<
    Screenplay & {
      voiceover?: VoiceoverManifest;
      sceneTimes?: (string | null)[];
      factTiles?: FactTile[];
      // identity sidecar (rewrite/identity, PR-F): consumed by the character
      // rig once it lands; not read by any scene component yet.
      identity?: UserIdentity;
    }
  > = (screenplay) => {
    const { fps } = useVideoConfig();
    return (
      <AbsoluteFill style={{ backgroundColor: pack.background }}>
        {/* factTiles sidecar (feat/session-facts): pre-formatted stat tiles,
            consumed by the stats scene via useFactTiles. */}
        <FactTilesContext.Provider value={screenplay.factTiles ?? EMPTY_TILES}>
        <pack.Audio screenplay={screenplay} />
        <Series>
          {screenplay.scenes.map((scene, i) => {
            const frames = sceneFrames(scene, fps);
            // voiceover cue plumbing (feat/vo-sync): resolve this scene's cue
            // to scene-local frames once; Caption consumes it via context.
            const cue = screenplay.voiceover?.cues.find((c) => c.sceneIndex === i);
            return (
              <Series.Sequence key={i} durationInFrames={frames}>
                <VoiceoverCueContext.Provider value={cue ? sceneLocalCue(cue, scene, fps) : null}>
                  {/* sceneTimes sidecar (feat/text-economy): pre-formatted
                      HH:MM per scene, or null — ClockChip consumes it. */}
                  <SceneTimeContext.Provider value={screenplay.sceneTimes?.[i] ?? null}>
                    <SceneRenderer scene={scene} screenplay={screenplay} durationInFrames={frames} />
                  </SceneTimeContext.Provider>
                </VoiceoverCueContext.Provider>
              </Series.Sequence>
            );
          })}
        </Series>
        {/* scene-transitions block (feat/effects): overlay above the scenes */}
        <CutTransitions screenplay={screenplay} />
        </FactTilesContext.Provider>
      </AbsoluteFill>
    );
  };
  return PackComposition;
};
