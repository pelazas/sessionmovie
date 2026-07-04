import { SHARED_SFX, SHARED_SFX_VOLUMES } from "./ClassicAudio";
import { makePackAudio } from "./makePackAudio";
import { BEATS } from "./questBeats";

/**
 * The quest pack's soundtrack: "Battle Theme A" (CC0, CREDITS.md) over the
 * shared v1 SFX set — the pack contract's audio slot (docs/genre-packs.md).
 */
export const QuestAudio = makePackAudio({
  track: "audio/music-battle-theme-a.mp3",
  beats: BEATS,
  sfx: SHARED_SFX,
  sfxVolumes: SHARED_SFX_VOLUMES,
});
