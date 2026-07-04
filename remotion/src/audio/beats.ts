// Beat grid for public/audio/music-cyber-runner.ogg ("Cyber Runner" by ansimuz, CC0).
//
// Precomputed OFFLINE (docs/audio.md: beat grid is data) — not derived at
// render time. Method: decoded the track to mono 11025 Hz PCM (Remotion's
// bundled ffmpeg), computed short-window (256-sample) RMS energy and its
// positive delta as an onset-flux curve, picked the beat period by
// autocorrelation of that flux over the 60-180 BPM lag range with parabolic
// peak refinement and octave correction into the 100-140 BPM band, then chose
// the grid phase that maximizes onset mass under the grid points.
// Result: 120.09 BPM, first beat at 0.046s, 197 beats over the 98s track.
export const TRACK_BPM = 120.09;

/** Beat timestamps in seconds from track start. Cuts and SFX snap to these. */
export const BEATS: readonly number[] = [
  0.046, 0.546, 1.046, 1.545, 2.045, 2.545, 3.044, 3.544, 4.043, 4.543,
  5.043, 5.542, 6.042, 6.541, 7.041, 7.541, 8.04, 8.54, 9.04, 9.539,
  10.039, 10.538, 11.038, 11.538, 12.037, 12.537, 13.037, 13.536, 14.036, 14.535,
  15.035, 15.535, 16.034, 16.534, 17.033, 17.533, 18.033, 18.532, 19.032, 19.532,
  20.031, 20.531, 21.03, 21.53, 22.03, 22.529, 23.029, 23.528, 24.028, 24.528,
  25.027, 25.527, 26.027, 26.526, 27.026, 27.525, 28.025, 28.525, 29.024, 29.524,
  30.024, 30.523, 31.023, 31.522, 32.022, 32.522, 33.021, 33.521, 34.02, 34.52,
  35.02, 35.519, 36.019, 36.519, 37.018, 37.518, 38.017, 38.517, 39.017, 39.516,
  40.016, 40.515, 41.015, 41.515, 42.014, 42.514, 43.014, 43.513, 44.013, 44.512,
  45.012, 45.512, 46.011, 46.511, 47.011, 47.51, 48.01, 48.509, 49.009, 49.509,
  50.008, 50.508, 51.007, 51.507, 52.007, 52.506, 53.006, 53.506, 54.005, 54.505,
  55.004, 55.504, 56.004, 56.503, 57.003, 57.502, 58.002, 58.502, 59.001, 59.501,
  60.001, 60.5, 61, 61.499, 61.999, 62.499, 62.998, 63.498, 63.998, 64.497,
  64.997, 65.496, 65.996, 66.496, 66.995, 67.495, 67.994, 68.494, 68.994, 69.493,
  69.993, 70.493, 70.992, 71.492, 71.991, 72.491, 72.991, 73.49, 73.99, 74.489,
  74.989, 75.489, 75.988, 76.488, 76.988, 77.487, 77.987, 78.486, 78.986, 79.486,
  79.985, 80.485, 80.985, 81.484, 81.984, 82.483, 82.983, 83.483, 83.982, 84.482,
  84.981, 85.481, 85.981, 86.48, 86.98, 87.48, 87.979, 88.479, 88.978, 89.478,
  89.978, 90.477, 90.977, 91.477, 91.976, 92.476, 92.975, 93.475, 93.975, 94.474,
  94.974, 95.473, 95.973, 96.473, 96.972, 97.472, 97.972,
];

/** The last beat at or before t (seconds into the track); -1 if before the first beat. */
export const beatIndexAt = (t: number): number => {
  let lo = 0, hi = BEATS.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (BEATS[mid] <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
};
