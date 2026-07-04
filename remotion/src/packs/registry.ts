import type { GenrePack } from "./types";

/**
 * The pack registry (docs/genre-packs.md): `registerGenre(pack)` at module
 * load, one <Composition> per registered pack in Root.tsx. `classic` is the
 * reference pack and permanent fallback — it must always be registered.
 */

const packs = new Map<string, GenrePack>();

export function registerGenre(pack: GenrePack): void {
  packs.set(pack.id, pack);
}

export function getPack(id: string): GenrePack {
  const pack = packs.get(id);
  if (!pack) {
    throw new Error(`unknown genre pack "${id}" — registered: ${[...packs.keys()].join(", ")}`);
  }
  return pack;
}

export function allPacks(): GenrePack[] {
  return [...packs.values()];
}
