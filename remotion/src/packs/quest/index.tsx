import { QuestAudio } from "../../audio/QuestAudio";
import { PERSONAS } from "../../../../src/genre/personas";
import type { GenrePack } from "../types";
import { quest } from "./theme";
import { QuestAction } from "./scenes/QuestAction";
import { QuestDialogue } from "./scenes/QuestDialogue";
import { QuestShowcase } from "./scenes/QuestShowcase";
import { QuestStats } from "./scenes/QuestStats";
import { QuestTitle } from "./scenes/QuestTitle";

/**
 * The quest pack (issue #9): the session as a monster hunt. The metaphor is
 * a RENDERING decision — the screenplay stays genre-neutral; this pack just
 * decides that an action scene is a battle and a red test is a boss attack.
 * Audio: quest's own CC0 music bed (CREDITS.md) over the shared v1 SFX set.
 */
export const questPack: GenrePack = {
  id: "quest",
  compositionId: "Quest",
  components: {
    title: ({ scene, durationInFrames }) => (
      <QuestTitle scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    dialogue: ({ scene, durationInFrames }) => (
      <QuestDialogue scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    action: ({ scene, durationInFrames }) => (
      <QuestAction scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    showcase: ({ scene, durationInFrames }) => (
      <QuestShowcase scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
    stats: ({ scene, durationInFrames }) => (
      <QuestStats scene={scene} caption={scene.caption} durationInFrames={durationInFrames} />
    ),
  },
  Audio: QuestAudio,
  background: quest.bg,
  // One source of truth for persona voices: src/genre/personas.ts (pure module).
  captionPersona: PERSONAS.quest,
};
