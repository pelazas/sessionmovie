// Beat grid for public/audio/music-lofi-chill.mp3 ("Something In the Air" by
// HoliznaCC0, from the "Lo-fi And Chill" album, CC0 1.0 — see CREDITS.md).
//
// Precomputed OFFLINE (docs/audio.md: beat grid is data) with
// scripts/beat-grid.ts — not derived at render time. Method: decoded the
// track to mono 11025 Hz PCM (Remotion's bundled ffmpeg), computed
// short-window (256-sample) RMS energy and its positive delta as an
// onset-flux curve, picked the beat period by autocorrelation of that flux
// over the 60-180 BPM lag range with parabolic peak refinement and octave
// correction into the 100-140 BPM band, then chose the grid phase that
// maximizes onset mass under the grid points. Regenerate with:
//   npx tsx scripts/beat-grid.ts remotion/public/audio/music-lofi-chill.mp3
// Result: 135.71 BPM, first beat at 0.318s, 298 beats over the 132s track.
//
// Pure data + lookup — zero imports, safe for both the renderer and the CLI
// (src/cli/movie.ts imports this module directly rather than beats.ts, so the
// beat-quantize step never pulls in renderer-side scene-schedule code).
export const TRACK_BPM = 135.71;

/** Beat timestamps in seconds from track start. Cuts and SFX snap to these. */
export const BEATS: readonly number[] = [
  0.318, 0.76, 1.202, 1.644, 2.086, 2.528, 2.97, 3.413, 3.855, 4.297,
  4.739, 5.181, 5.623, 6.065, 6.507, 6.949, 7.392, 7.834, 8.276, 8.718,
  9.16, 9.602, 10.044, 10.486, 10.928, 11.371, 11.813, 12.255, 12.697, 13.139,
  13.581, 14.023, 14.465, 14.907, 15.35, 15.792, 16.234, 16.676, 17.118, 17.56,
  18.002, 18.444, 18.886, 19.328, 19.771, 20.213, 20.655, 21.097, 21.539, 21.981,
  22.423, 22.865, 23.307, 23.75, 24.192, 24.634, 25.076, 25.518, 25.96, 26.402,
  26.844, 27.286, 27.729, 28.171, 28.613, 29.055, 29.497, 29.939, 30.381, 30.823,
  31.265, 31.708, 32.15, 32.592, 33.034, 33.476, 33.918, 34.36, 34.802, 35.244,
  35.687, 36.129, 36.571, 37.013, 37.455, 37.897, 38.339, 38.781, 39.223, 39.666,
  40.108, 40.55, 40.992, 41.434, 41.876, 42.318, 42.76, 43.202, 43.645, 44.087,
  44.529, 44.971, 45.413, 45.855, 46.297, 46.739, 47.181, 47.624, 48.066, 48.508,
  48.95, 49.392, 49.834, 50.276, 50.718, 51.16, 51.603, 52.045, 52.487, 52.929,
  53.371, 53.813, 54.255, 54.697, 55.139, 55.582, 56.024, 56.466, 56.908, 57.35,
  57.792, 58.234, 58.676, 59.118, 59.56, 60.003, 60.445, 60.887, 61.329, 61.771,
  62.213, 62.655, 63.097, 63.539, 63.982, 64.424, 64.866, 65.308, 65.75, 66.192,
  66.634, 67.076, 67.518, 67.961, 68.403, 68.845, 69.287, 69.729, 70.171, 70.613,
  71.055, 71.497, 71.94, 72.382, 72.824, 73.266, 73.708, 74.15, 74.592, 75.034,
  75.476, 75.919, 76.361, 76.803, 77.245, 77.687, 78.129, 78.571, 79.013, 79.455,
  79.898, 80.34, 80.782, 81.224, 81.666, 82.108, 82.55, 82.992, 83.434, 83.877,
  84.319, 84.761, 85.203, 85.645, 86.087, 86.529, 86.971, 87.413, 87.856, 88.298,
  88.74, 89.182, 89.624, 90.066, 90.508, 90.95, 91.392, 91.835, 92.277, 92.719,
  93.161, 93.603, 94.045, 94.487, 94.929, 95.371, 95.814, 96.256, 96.698, 97.14,
  97.582, 98.024, 98.466, 98.908, 99.35, 99.792, 100.235, 100.677, 101.119, 101.561,
  102.003, 102.445, 102.887, 103.329, 103.771, 104.214, 104.656, 105.098, 105.54, 105.982,
  106.424, 106.866, 107.308, 107.75, 108.193, 108.635, 109.077, 109.519, 109.961, 110.403,
  110.845, 111.287, 111.729, 112.172, 112.614, 113.056, 113.498, 113.94, 114.382, 114.824,
  115.266, 115.708, 116.151, 116.593, 117.035, 117.477, 117.919, 118.361, 118.803, 119.245,
  119.687, 120.13, 120.572, 121.014, 121.456, 121.898, 122.34, 122.782, 123.224, 123.666,
  124.109, 124.551, 124.993, 125.435, 125.877, 126.319, 126.761, 127.203, 127.645, 128.088,
  128.53, 128.972, 129.414, 129.856, 130.298, 130.74, 131.182, 131.624,
];

/** The last beat at or before t (seconds into the track); -1 if before the first beat. */
export const beatIndexAt = (t: number): number => {
  let lo = 0, hi = BEATS.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((BEATS[mid] ?? Infinity) <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
};
