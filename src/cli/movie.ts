/**
 * npx sessionmovie <transcript.jsonl> [--out movie.mp4] [--keep-screenplay]
 *
 * The one command: transcript → timeline → screenplay → rendered MP4.
 * Exit codes: 0 rendered, 2 graceful decline ("not enough footage"), 1 error.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { writeScreenplay } from "../screenwriter/heuristic.js";
import { validateScreenwriterJson, writeScreenplayLLMDetailed } from "../screenwriter/llm.js";
import { ScreenplaySchema, type Screenplay } from "../screenplay/schema.js";
import { remotionCliInstalled, runRemotion } from "./workspace.js";
// voiceover integration (feat/voiceover)
import { buildVoiceoverManifest } from "../voiceover/manifest.js";
import { ttsConfigFromEnv } from "../voiceover/tts.js";
// genre auto-pick block (feat/genre-rules, issue #10)
import { compositionFor } from "../genre/compositions.js";
// ── T5 pipeline wiring: beat-quantize → TTS (punch-up retired with the quest pack) ──
import { BEATS as CLASSIC_BEATS } from "../../remotion/src/audio/beatData.js";
import { BEATS as QUEST_BEATS } from "../../remotion/src/audio/questBeatData.js";
import { quantizeToBeats } from "../quantize.js";
import { voiceForGenre } from "../voiceover/manifest.js";
import { GENRES, isGenre, pickGenre, signalsFrom, type Genre } from "../genre/rules.js";
import { buildSessionFacts, pickFactTiles } from "../facts/facts.js";
import { sceneTimesFor } from "../facts/sceneTimes.js";
// GitHub identity pipeline (rewrite/identity, PR-F)
import { resolveUserIdentity } from "../identity/index.js";
import type { Timeline } from "../parser/types.js";

// Matches the composition (remotion/src/Root.tsx + Classic.tsx): 30fps, each
// scene rounds targetSec to whole frames. Keep in sync so the printed duration
// is the real one, not the screenplay's nominal target.
const FPS = 30;

function movieDurationSec(screenplay: Screenplay): number {
  const frames = screenplay.scenes.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.targetSec * FPS)),
    0,
  );
  return frames / FPS;
}

function usage(): never {
  process.stderr.write(
    "usage: sessionmovie <transcript.jsonl> [--out movie.mp4] [--genre <id>] [--keep-screenplay] [--no-llm] [--voiceover] [--refresh-voices] [--screenplay <file>]\n" +
      "       sessionmovie doctor — check setup (node, remotion, browser, voiceover key)\n" +
      "       sessionmovie prompt <transcript.jsonl> — print the screenwriter prompt (skill path)\n",
  );
  process.exit(1);
}

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);

// ── genre auto-pick block (feat/genre-rules, issue #10) ─────────────────────
// --genre <id> always wins (Layer 2, docs/genre-packs.md); otherwise the
// deterministic rules table picks from the session shape (Layer 1) and the
// pick is printed so it's explainable. Unshipped genres render as classic.
// The flag is extracted here, BEFORE the main flag loop, so the loop below
// stays untouched.
let genreOverride: Genre | undefined;
const genreFlagAt = args.indexOf("--genre");
if (genreFlagAt !== -1) {
  const id = args[genreFlagAt + 1];
  if (!id || id.startsWith("-")) usage();
  if (!isGenre(id)) {
    fail(`unknown genre '${id}' — known genres: ${GENRES.join(", ")}`);
  }
  genreOverride = id;
  args.splice(genreFlagAt, 2);
}
/** Genre + composition for the timeline; prints the one explainable line. */
function resolveGenreComposition(timeline: Timeline): { compositionId: string; genre: Genre } {
  const pick = genreOverride
    ? { genre: genreOverride, reason: "--genre override, auto-pick skipped" }
    : pickGenre(signalsFrom(timeline));
  const { compositionId, shipped } = compositionFor(pick.genre);
  process.stdout.write(
    `   genre: ${pick.genre} (${pick.reason})` +
      (shipped ? "" : ` → rendering classic (${pick.genre} not shipped yet)`) +
      "\n",
  );
  return { compositionId, genre: pick.genre };
}
// ── end genre auto-pick block ───────────────────────────────────────────────

let input: string | undefined;
let out = "movie.mp4";
let keepScreenplay = false;
let useLlm = true;
let voiceover = false; // voiceover integration (feat/voiceover)
let refreshVoices = false; // voiceover integration (feat/voiceover)
let screenplayFile: string | null = null; // skill path (--screenplay)
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--out" || arg === "-o") {
    const next = args[++i];
    if (!next) usage();
    out = next;
  } else if (arg === "--keep-screenplay") {
    keepScreenplay = true;
  } else if (arg === "--no-llm") {
    useLlm = false;
  } else if (arg === "--voiceover") {
    // voiceover integration (feat/voiceover)
    voiceover = true;
  } else if (arg === "--refresh-voices") {
    // voiceover integration (feat/voiceover)
    refreshVoices = true;
  } else if (arg === "--screenplay") {
    const next = args[++i];
    if (!next) usage();
    screenplayFile = next;
  } else if (arg && !arg.startsWith("-")) {
    if (input) usage();
    input = arg;
  } else {
    usage();
  }
}
if (!input) usage();
if (screenplayFile && !useLlm) usage(); // contradictory: --screenplay already skips the LLM

// First output within the first second — never hang silently.
process.stdout.write(`🎬 sessionmovie — reading ${input}\n`);

const startedAt = Date.now();
const outPath = resolve(out);

let jsonl: string;
try {
  jsonl = readFileSync(resolve(input), "utf8");
} catch (err) {
  fail(`cannot read transcript: ${err instanceof Error ? err.message : String(err)}`);
}

const timeline = parseTranscript(jsonl);
const { compositionId: genreComposition, genre } = resolveGenreComposition(timeline); // genre auto-pick block (issue #10)
// LLM screenwriter is the default (real narrative, funny captions); it falls
// back to the heuristic on its own when `claude` is missing or attempts fail.
let result;
if (screenplayFile) {
  // Skill path: the screenplay was written in-session (or by any external
  // writer); same validation contract as the LLM stage, then the normal
  // render boundary below re-validates like always.
  let screenplayJson = "";
  try {
    screenplayJson = readFileSync(resolve(screenplayFile), "utf8");
  } catch (err) {
    fail(`cannot read --screenplay file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const provided = validateScreenwriterJson(screenplayJson);
  if ("issues" in provided) {
    process.stderr.write(`--screenplay rejected by the schema:\n${provided.issues}\n`);
    process.exit(1);
  }
  result = provided;
  process.stdout.write("   screenwriter: provided via --screenplay\n");
} else if (useLlm) {
  process.stdout.write("   writing screenplay with claude (~1 min; --no-llm for the fast heuristic)…\n");
  const detailed = writeScreenplayLLMDetailed(timeline);
  result = detailed.output;
  process.stdout.write(
    `   screenwriter: ${detailed.source}${detailed.attempts ? ` (${detailed.attempts} attempt${detailed.attempts > 1 ? "s" : ""})` : ""}\n`,
  );
} else {
  result = writeScreenplay(timeline);
}

if ("decline" in result) {
  process.stderr.write(`🎬 no movie: ${result.reason}\n`);
  process.exit(2);
}

// Re-validate at the render boundary: nothing unvalidated reaches --props.
const validated = ScreenplaySchema.safeParse(result);
if (!validated.success) {
  const issues = validated.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  fail(`screenwriter produced an invalid screenplay (bug): ${issues}`);
}
let screenplay = validated.data;

// ── T5 pipeline: beat quantize (punch-up retired until a second genre pack
// exists — docs/genre-packs.md) ─────────────────────────────────────────────
{
  const beats = genreComposition === "Quest" ? QUEST_BEATS : CLASSIC_BEATS;
  const quantized = quantizeToBeats(screenplay, [...beats], FPS);
  const nudged = quantized.scenes.filter(
    (sc, i) => sc.targetSec !== screenplay.scenes[i]?.targetSec,
  ).length;
  process.stdout.write(
    nudged > 0
      ? `   beat-sync: ${nudged} scene cut(s) snapped to the ${genreComposition} grid\n`
      : "   beat-sync: cuts already on the grid\n",
  );
  screenplay = quantized;
}
// ── end T5 pipeline ─────────────────────────────────────────────────────────

process.stdout.write(
  `   screenplay ready: ${screenplay.scenes.length} scenes ` +
    `(${screenplay.scenes.map((s) => s.type).join(" → ")})\n`,
);

// ── voiceover integration block (feat/voiceover) ────────────────────────────
// Opt-in ElevenLabs narration of scene captions (docs/audio.md prototype tier).
// All API calls happen HERE, pre-render — never inside compositions. The
// manifest rides as a renderer-side sidecar in the composition input props;
// the frozen screenplay IR is untouched.
let renderProps: Record<string, unknown> = screenplay;
if (voiceover) {
  const ttsConfig = ttsConfigFromEnv();
  if (!ttsConfig) {
    fail(
      "--voiceover needs ELEVENLABS_API_KEY in the environment — export it or `set -a; source .env; set +a` first",
    );
  }
  process.stdout.write(
    `   voiceover: narrating captions (ElevenLabs, voice ${voiceForGenre(genre)}, ${ttsConfig.model}, ${genre} persona)…\n`,
  );
  try {
    const stats = await buildVoiceoverManifest(screenplay, ttsConfig, {
      refresh: refreshVoices,
      genre, // per-genre voice (T5 wiring — Daniel narrates quest)
    });
    process.stdout.write(
      `   voiceover: ${stats.manifest.cues.length} cue(s) — ${stats.apiCalls} API call(s), ` +
        `${stats.cacheHits} cache hit(s), ${stats.skipped.length} skipped by fit rule\n`,
    );
    renderProps = { ...screenplay, voiceover: stats.manifest };
  } catch (err) {
    fail(`voiceover failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
// ── end voiceover integration block ─────────────────────────────────────────

// ── session-facts sidecar block (feat/session-facts) ────────────────────────
// SessionFacts → ≤3 pre-formatted fact tiles + per-scene clock times, riding
// the composition input props next to the voiceover manifest. The frozen IR
// is untouched; the renderer displays these verbatim and never derives a
// number (docs/v1-storychange.md "Session facts").
{
  const facts = buildSessionFacts(timeline);
  const factTiles = pickFactTiles(facts);
  const sceneTimes = sceneTimesFor(screenplay, timeline);
  renderProps = { ...renderProps, sceneTimes, ...(factTiles.length > 0 && { factTiles }) };
  if (factTiles.length > 0) {
    process.stdout.write(
      `   facts: ${factTiles.map((t) => `${t.value} ${t.label}`).join(" · ")}\n`,
    );
  }
}
// ── end session-facts sidecar block ─────────────────────────────────────────

// ── identity sidecar block (rewrite/identity, PR-F) ─────────────────────────
// The user's GitHub avatar head + body tint, resolved CLI-side only (no
// network from compositions — docs/security-and-privacy.md "GitHub identity
// carve-out"). Rides the composition input props as a sidecar, same as facts
// and voiceover; the character rig consumes it.
{
  const identity = await resolveUserIdentity();
  renderProps = { ...renderProps, identity };
}
// ── end identity sidecar block ───────────────────────────────────────────────

if (!remotionCliInstalled()) {
  fail("Remotion is not installed — run `npm install`, then `sessionmovie doctor` to verify setup");
}

const screenplayPath = keepScreenplay
  ? join(dirname(outPath), `${basename(outPath).replace(/\.[^.]+$/, "")}.screenplay.json`)
  : join(dirname(outPath), `.${basename(outPath)}.screenplay.tmp.json`);
mkdirSync(dirname(outPath), { recursive: true });
// renderProps = screenplay (+ voiceover sidecar when --voiceover) — see block above.
writeFileSync(screenplayPath, `${JSON.stringify(renderProps, null, 2)}\n`);

process.stdout.write("   rendering with Remotion (first run may take a few minutes)…\n");
const code = await runRemotion([
  "render",
  "src/index.ts",
  genreComposition, // genre auto-pick block (issue #10) — was hardcoded "Classic"
  outPath,
  `--props=${screenplayPath}`,
]);
if (!keepScreenplay) rmSync(screenplayPath, { force: true });
if (code !== 0) {
  fail(`remotion render failed (exit ${code}) — try \`sessionmovie doctor\``);
}

const elapsedSec = Math.round((Date.now() - startedAt) / 10) / 100;
const t = timeline.totals;
process.stdout.write(
  `🎬 ${outPath} — ${movieDurationSec(screenplay)}s movie` +
    (keepScreenplay ? ` (screenplay kept at ${screenplayPath})` : "") +
    "\n" +
    `   session: ${t.toolCalls} tool calls, ${t.filesTouched} files, ` +
    `+${t.added}/−${t.removed}, ${t.turns} turns — rendered in ${elapsedSec}s\n`,
);
