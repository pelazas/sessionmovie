/**
 * Offline beat-grid extraction — the method documented in
 * remotion/src/audio/beats.ts, formalized as a runnable script
 * (docs/audio.md: "beat grid is data" — computed offline, committed
 * as numbers with a comment on how).
 *
 *   npx tsx scripts/beat-grid.ts <audio-file> [--band 100-140]
 *
 * Prints a ready-to-paste `TRACK_BPM` + `BEATS` module body to stdout.
 * Diagnostics (duration, autocorrelation peak, grid onset-mass score) go
 * to stderr so stdout stays clean for redirection.
 *
 * Method, step by step (same as the committed cyber-runner grid):
 *   1. Decode to mono 11025 Hz PCM via Remotion's bundled ffmpeg.
 *   2. 256-sample-window RMS energy; its positive delta is the onset flux.
 *   3. Beat period by autocorrelation of the flux over the 60–180 BPM lag
 *      range, parabolic peak refinement, octave correction into the target
 *      band (default 100–140 BPM).
 *   4. Grid phase chosen to maximize onset mass under the grid points.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { remotionDir } from "../src/cli/workspace.js";

const SAMPLE_RATE = 11025;
const WINDOW = 256;
/** Onset-flux frames per second. */
const FRAME_RATE = SAMPLE_RATE / WINDOW;

function usage(): never {
  process.stderr.write("usage: npx tsx scripts/beat-grid.ts <audio-file> [--band lo-hi]\n");
  process.exit(1);
}

/**
 * Decode any ffmpeg-readable audio to mono 11025 Hz float samples.
 * Goes through a temp WAV (Remotion's trimmed ffmpeg has no raw s16le muxer)
 * and reads the samples out of the WAV's `data` chunk.
 */
function decodeMono(audioPath: string): Float32Array {
  const dir = mkdtempSync(join(tmpdir(), "beat-grid-"));
  const wav = join(dir, "audio.wav");
  try {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const res = spawnSync(
      npx,
      [
        "remotion",
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        audioPath,
        "-ac",
        "1",
        "-ar",
        String(SAMPLE_RATE),
        "-c:a",
        "pcm_s16le",
        "-y",
        wav,
      ],
      { cwd: remotionDir, encoding: "utf8" },
    );
    if (res.status !== 0) {
      throw new Error(`ffmpeg decode failed (exit ${res.status}): ${res.stderr || res.stdout}`);
    }
    const buf = readFileSync(wav);
    // Walk RIFF chunks to the `data` chunk (headers vary; 44 bytes is a myth).
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const id = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      if (id === "data") {
        const samples = new Float32Array(size >> 1);
        for (let i = 0; i < samples.length; i++) {
          samples[i] = buf.readInt16LE(offset + 8 + i * 2) / 32768;
        }
        return samples;
      }
      offset += 8 + size + (size & 1);
    }
    throw new Error(`no data chunk found in decoded WAV for ${audioPath}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Positive delta of short-window RMS energy — one value per WINDOW samples. */
function onsetFlux(samples: Float32Array): Float32Array {
  const n = Math.floor(samples.length / WINDOW);
  const rms = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let sum = 0;
    for (let i = w * WINDOW; i < (w + 1) * WINDOW; i++) sum += (samples[i] ?? 0) ** 2;
    rms[w] = Math.sqrt(sum / WINDOW);
  }
  const flux = new Float32Array(n);
  for (let w = 1; w < n; w++) flux[w] = Math.max(0, (rms[w] ?? 0) - (rms[w - 1] ?? 0));
  return flux;
}

function autocorr(flux: Float32Array, lag: number): number {
  let sum = 0;
  for (let i = 0; i + lag < flux.length; i++) sum += (flux[i] ?? 0) * (flux[i + lag] ?? 0);
  return sum;
}

/**
 * Beat period in flux frames: autocorrelation peak over the 60–180 BPM lag
 * range, refined by fitting a parabola through the peak and its neighbors.
 * Also returns the peak normalized by lag-0 energy as a clarity diagnostic.
 */
function beatPeriod(flux: Float32Array): { lag: number; clarity: number } {
  const minLag = Math.max(2, Math.floor((FRAME_RATE * 60) / 180));
  const maxLag = Math.ceil((FRAME_RATE * 60) / 60);
  let bestLag = minLag;
  let bestR = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const r = autocorr(flux, lag);
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  // Parabolic refinement: sub-frame peak between the integer neighbors.
  const y0 = autocorr(flux, bestLag - 1);
  const y1 = bestR;
  const y2 = autocorr(flux, bestLag + 1);
  const denom = y0 - 2 * y1 + y2;
  const shift = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom));
  return { lag: bestLag + shift, clarity: bestR / (autocorr(flux, 0) || 1) };
}

/** Fold the BPM by octaves as close to (ideally into) [lo, hi] as possible. */
function octaveCorrect(bpm: number, lo: number, hi: number): number {
  let best = bpm;
  let bestDist = Infinity;
  for (let k = -2; k <= 2; k++) {
    const candidate = bpm * 2 ** k;
    const dist = candidate < lo ? lo - candidate : candidate > hi ? candidate - hi : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/** Grid phase (in flux frames, within one period) maximizing onset mass. */
function bestPhase(flux: Float32Array, period: number): { phase: number; mass: number } {
  const steps = 128;
  let bestPhaseFrames = 0;
  let bestMass = -Infinity;
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * period;
    let mass = 0;
    let count = 0;
    for (let t = phase; t < flux.length; t += period) {
      mass += flux[Math.round(t)] ?? 0;
      count++;
    }
    mass /= Math.max(1, count);
    if (mass > bestMass) {
      bestMass = mass;
      bestPhaseFrames = phase;
    }
  }
  return { phase: bestPhaseFrames, mass: bestMass };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let input: string | undefined;
let band: [number, number] = [100, 140];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--band") {
    const next = args[++i];
    const m = next?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (!m) usage();
    band = [Number(m[1]), Number(m[2])];
    if (!(band[0] > 0 && band[1] > band[0])) usage();
  } else if (arg && !arg.startsWith("-")) {
    if (input) usage();
    input = arg;
  } else {
    usage();
  }
}
if (!input) usage();

const audioPath = resolve(input);
const samples = decodeMono(audioPath);
const durationSec = samples.length / SAMPLE_RATE;
const flux = onsetFlux(samples);

const { lag, clarity } = beatPeriod(flux);
const bpm = octaveCorrect((60 * FRAME_RATE) / lag, band[0], band[1]);
const period = (60 * FRAME_RATE) / bpm;
const { phase, mass } = bestPhase(flux, period);

const beats: number[] = [];
for (let t = phase; (t * WINDOW) / SAMPLE_RATE < durationSec; t += period) {
  beats.push(Number(((t * WINDOW) / SAMPLE_RATE).toFixed(3)));
}

let meanFlux = 0;
for (let i = 0; i < flux.length; i++) meanFlux += flux[i] ?? 0;
meanFlux /= Math.max(1, flux.length);

process.stderr.write(
  `${basename(audioPath)}: ${durationSec.toFixed(1)}s, ${bpm.toFixed(2)} BPM, ` +
    `${beats.length} beats, first at ${beats[0]}s\n` +
    `  autocorr clarity ${clarity.toFixed(3)} (peak/lag0), ` +
    `grid onset mass ${(mass / (meanFlux || 1)).toFixed(2)}x mean flux\n`,
);

const lines: string[] = [];
for (let i = 0; i < beats.length; i += 10) {
  lines.push(`  ${beats.slice(i, i + 10).join(", ")},`);
}
process.stdout.write(
  `// Beat grid for ${basename(audioPath)} — generated by scripts/beat-grid.ts.\n` +
    `// ${bpm.toFixed(2)} BPM, first beat at ${beats[0]}s, ${beats.length} beats over the ${Math.round(durationSec)}s track.\n` +
    `export const TRACK_BPM = ${bpm.toFixed(2)};\n\n` +
    `/** Beat timestamps in seconds from track start. Cuts and SFX snap to these. */\n` +
    `export const BEATS: readonly number[] = [\n${lines.join("\n")}\n];\n`,
);
