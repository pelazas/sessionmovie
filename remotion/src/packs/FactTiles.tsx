import { createContext, useContext } from "react";
import type { FactTile } from "../../../src/facts/types";

/**
 * Session-fact tiles (docs/v1-storychange.md "Session facts"): up to 3
 * pre-formatted stats picked CLI-side by deterministic interestingness
 * rules and delivered via the `factTiles` input-props sidecar — the same
 * mechanism as the voiceover manifest and sceneTimes. The renderer displays
 * label/value verbatim; it never computes a number. Old props files simply
 * have no tiles and render exactly as before.
 */
export const FactTilesContext = createContext<FactTile[]>([]);

export const useFactTiles = (): FactTile[] => useContext(FactTilesContext);
