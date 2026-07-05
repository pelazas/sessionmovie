/**
 * Genre → Remotion composition id. THIS TABLE IS THE CONTRACT with future
 * genre-pack work: shipping a pack means adding one entry here. Keep it dumb
 * and additive — no logic beyond the explicit classic fallthrough.
 */
import type { Genre } from "./rules.js";

export const GENRE_COMPOSITIONS: Partial<Record<Genre, string>> = {
  classic: "Classic",
};

const CLASSIC_ID = "Classic";

/** Resolve a pick to a renderable composition; unshipped genres fall through. */
export function compositionFor(genre: Genre): { compositionId: string; shipped: boolean } {
  const id = GENRE_COMPOSITIONS[genre];
  return id !== undefined
    ? { compositionId: id, shipped: true }
    : { compositionId: GENRE_COMPOSITIONS.classic ?? CLASSIC_ID, shipped: false };
}
