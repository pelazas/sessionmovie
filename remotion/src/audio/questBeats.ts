// Re-exports the pure beat-grid data from ./questBeatData — kept as a stable
// import path for renderer-side consumers. The CLI (src/cli/movie.ts) imports
// ./questBeatData directly instead, same reasoning as beats.ts/beatData.ts.
export { TRACK_BPM, BEATS } from "./questBeatData";
