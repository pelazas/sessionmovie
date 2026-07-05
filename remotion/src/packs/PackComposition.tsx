import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from "remotion";
import type { StatCard, TitleMeta } from "../../../src/facts/types";
import type { UserIdentity } from "../../../src/identity/types";
import type { VoiceoverManifest } from "../../../src/voiceover/types";
import { DEFAULT_IDENTITY, IdentityContext } from "../characters/identity";
import { SceneTimeContext } from "./ClockChip";
import { CompressionContext, StatCardsContext, TitleMetaContext } from "./sidecars";
import { sceneLocalTrack } from "./voiceoverSync";
import type { Scene, Screenplay } from "../screenplay";
import { theme } from "../theme";
import { flash } from "../motion";
import { sceneCutFrames, sceneFrames } from "../timing";
import { DialogueTrackContext, type GenrePack } from "./types";

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
  // A 4-frame flash/whip at every scene handoff: a cold shutter. Cut FRAMES
  // come from the shared sceneCutFrames (beat-aligned upstream by the CLI
  // quantizer) — no timing logic of our own. The whoosh SFX cue in
  // audio/events.ts fires at the same frames.
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
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme.accentSoft,
          opacity: opacity * 0.85,
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
      statCards?: StatCard[];
      compressionLine?: string;
      titleMeta?: TitleMeta;
      // identity sidecar (rewrite/identity, PR-F): consumed by the character
      // rig via IdentityContext.
      identity?: UserIdentity;
    }
  > = (screenplay) => {
    const { fps } = useVideoConfig();
    return (
      <AbsoluteFill style={{ backgroundColor: pack.background }}>
        {/* no-genre sidecars (PR-G data, PR-E consumption): identity for the
            character rig, statCards/compressionLine/titleMeta for the stats
            and title scenes. factTiles/achievements/grade are retired — the
            same numbers now live in statCards. */}
        <IdentityContext.Provider value={screenplay.identity ?? DEFAULT_IDENTITY}>
        <StatCardsContext.Provider value={screenplay.statCards ?? []}>
        <TitleMetaContext.Provider value={screenplay.titleMeta ?? {}}>
        <CompressionContext.Provider value={screenplay.compressionLine ?? null}>
        <pack.Audio screenplay={screenplay} />
        <Series>
          {screenplay.scenes.map((scene, i) => {
            const frames = sceneFrames(scene, fps);
            // dialogue voiceover plumbing (rewrite/voiceover-dialogue, PR-H):
            // resolve this dialogue scene's per-line track to scene-local
            // frames once; Dialogue.tsx consumes it via context, falling
            // back to the no-VO schedule when null.
            const track = scene.type === "dialogue" && screenplay.voiceover
              ? sceneLocalTrack(screenplay.voiceover.lineCues, i, fps)
              : null;
            return (
              <Series.Sequence key={i} durationInFrames={frames}>
                <DialogueTrackContext.Provider value={track}>
                  {/* sceneTimes sidecar (feat/text-economy): pre-formatted
                      HH:MM per scene, or null — ClockChip consumes it. */}
                  <SceneTimeContext.Provider value={screenplay.sceneTimes?.[i] ?? null}>
                    <SceneRenderer scene={scene} screenplay={screenplay} durationInFrames={frames} />
                  </SceneTimeContext.Provider>
                </DialogueTrackContext.Provider>
              </Series.Sequence>
            );
          })}
        </Series>
        {/* scene-transitions block (feat/effects): overlay above the scenes */}
        <CutTransitions screenplay={screenplay} />
        </CompressionContext.Provider>
        </TitleMetaContext.Provider>
        </StatCardsContext.Provider>
        </IdentityContext.Provider>
      </AbsoluteFill>
    );
  };
  return PackComposition;
};
