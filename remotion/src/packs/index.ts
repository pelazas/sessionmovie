import { allPacks, registerGenre } from "./registry";
import { classicPack } from "./classic";
import { questPack } from "./quest";

/**
 * Pack registration — one registerGenre() call per shipped pack. Shipping a
 * new pack = register it here + add its composition id to
 * src/genre/compositions.ts (the CLI mapping table).
 *
 * Root.tsx consumes PACKS (defined HERE, after registration) rather than
 * allPacks() re-exported from the registry: a bundler may rewrite pure
 * re-exports to the source module and skip this module's side effects
 * entirely — importing a value defined in this module cannot be skipped.
 */
registerGenre(classicPack);
registerGenre(questPack);

export const PACKS = allPacks();

export { getPack, registerGenre } from "./registry";
export { makePackComposition } from "./PackComposition";
export type { GenrePack, SceneProps } from "./types";
