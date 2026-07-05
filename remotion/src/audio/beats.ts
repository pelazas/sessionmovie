// Re-exports the pure beat-grid data from ./beatData — kept as a stable
// import path for renderer-side consumers. The CLI (src/cli/movie.ts) imports
// ./beatData directly instead, so the beat-quantize step never pulls in
// renderer-side scene-schedule code (remotion/src/timing.ts) into the root
// TypeScript program.
export { TRACK_BPM, BEATS, beatIndexAt } from "./beatData";
