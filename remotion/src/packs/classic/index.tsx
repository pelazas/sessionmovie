import { ClassicAudio } from "../../audio/ClassicAudio";
import { theme } from "../../theme";
import type { GenrePack } from "../types";
import { Action } from "./scenes/Action";
import { Dialogue } from "./scenes/Dialogue";
import { Showcase } from "./scenes/Showcase";
import { Stats } from "./scenes/Stats";
import { Title } from "./scenes/Title";

/**
 * The classic pack — reference implementation and permanent fallback
 * (docs/genre-packs.md): minimal, genre-free, always works, and the
 * template new packs copy.
 */
export const classicPack: GenrePack = {
  id: "classic",
  compositionId: "Classic",
  components: {
    title: ({ scene, screenplay, durationInFrames }) => (
      <Title
        scene={scene}
        caption={scene.caption}
        repo={screenplay.sessionMeta.repo}
        durationInFrames={durationInFrames}
      />
    ),
    dialogue: ({ scene, durationInFrames }) => (
      <Dialogue scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    action: ({ scene, durationInFrames }) => (
      <Action scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    showcase: ({ scene, durationInFrames }) => (
      <Showcase scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    stats: ({ scene, durationInFrames }) => (
      <Stats scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
  },
  Audio: ClassicAudio,
  background: theme.bg,
  captionPersona:
    "deadpan, self-aware, a little judgmental — a nature-documentary narrator who has seen too many coding sessions",
};
