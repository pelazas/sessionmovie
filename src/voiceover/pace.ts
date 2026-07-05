import type { Screenplay } from "../screenplay/schema.js";
import { ScreenplaySchema } from "../screenplay/schema.js";
import type { CharacterAlignment, VoiceoverLineCue } from "./types.js";
import { getOrSynthesize } from "./cache.js";
import { probeDurationSec, readAlignmentFile } from "./manifest.js";
import { wordsFromAlignment, VO_GAP_SEC, VO_LEAD_SEC, VO_TAIL_SEC } from "./sync-core.js";
import { DEFAULT_VOICE_ID, type TTSConfig } from "./tts.js";

/** Precedence: ELEVENLABS_VOICE_USER/CLAUDE → ELEVENLABS_VOICE_ID → default narrator. */
export function voiceForSpeaker(speaker: "user" | "claude", env: NodeJS.ProcessEnv = process.env): string {
  return env[`ELEVENLABS_VOICE_${speaker.toUpperCase()}`] ?? env["ELEVENLABS_VOICE_ID"] ?? DEFAULT_VOICE_ID;
}

export interface SynthResult { lineCues: VoiceoverLineCue[]; apiCalls: number; cacheHits: number; }
export interface SynthOptions {
  refresh?: boolean; env?: NodeJS.ProcessEnv;
  synthesizeCue?: typeof getOrSynthesize; probe?: typeof probeDurationSec;
  readAlignment?: (p: string) => CharacterAlignment | null;
}

/** Synthesize every dialogue line (speaker voice, cached). THROWS on any failure
 *  so the caller degrades the WHOLE movie to silent — never partial narration. */
export async function synthesizeDialogue(screenplay: Screenplay, config: TTSConfig, opts: SynthOptions = {}): Promise<SynthResult> {
  const env = opts.env ?? process.env;
  const synth = opts.synthesizeCue ?? getOrSynthesize;
  const probe = opts.probe ?? probeDurationSec;
  const readAlignment = opts.readAlignment ?? readAlignmentFile;
  const lineCues: VoiceoverLineCue[] = [];
  let apiCalls = 0, cacheHits = 0;
  for (const [sceneIndex, scene] of screenplay.scenes.entries()) {
    if (scene.type !== "dialogue") continue;
    for (const [lineIndex, line] of scene.lines.entries()) {
      const cfg: TTSConfig = { ...config, voiceId: voiceForSpeaker(line.speaker, env) };
      const cached = await synth(line.text, cfg, opts.refresh !== undefined ? { refresh: opts.refresh } : {});
      cached.apiCalled ? apiCalls++ : cacheHits++;
      lineCues.push({
        sceneIndex, lineIndex, speaker: line.speaker, text: line.text,
        file: cached.publicPath, durationSec: probe(cached.absolutePath),
        timestampsFile: cached.timestampsPublicPath,
        words: wordsFromAlignment(readAlignment(cached.timestampsPath)),
      });
    }
  }
  return { lineCues, apiCalls, cacheHits };
}

// ── pure resize (unit-testable, like quantize.ts) ──
const FLOORS: Record<string, number> = { title: 3, action: 5, showcase: 4, stats: 4 };
const D_MIN = 3, D_MAX = 9;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const dialogueNeed = (durs: number[]) => durs.reduce((a, b) => a + b, 0) + VO_GAP_SEC * Math.max(0, durs.length - 1) + VO_LEAD_SEC + VO_TAIL_SEC;

export interface ResizeResult { ok: boolean; screenplay: Screenplay; lineCues: VoiceoverLineCue[]; droppedLines: number; }

/** Lock each dialogue scene to its measured audio; renormalize the rest to hold
 *  the total (per-type floors); drop trailing cues that overflow 9s; degrade
 *  (ok:false) when even that can't fit the budget. Pure. */
export function resizeDialogueToVoiceover(screenplay: Screenplay, lineCues: VoiceoverLineCue[]): ResizeResult {
  const total = screenplay.targetDurationSec, tol = total * 0.1;
  const byScene = new Map<number, VoiceoverLineCue[]>();
  for (const c of lineCues) (byScene.get(c.sceneIndex) ?? byScene.set(c.sceneIndex, []).get(c.sceneIndex)!).push(c);
  for (const a of byScene.values()) a.sort((x, y) => x.lineIndex - y.lineIndex);

  const kept: VoiceoverLineCue[] = [];
  const dSec = new Map<number, number>();
  let dropped = 0;
  screenplay.scenes.forEach((scene, i) => {
    if (scene.type !== "dialogue") return;
    let arr = byScene.get(i) ?? [];
    while (arr.length > 0 && dialogueNeed(arr.map((c) => c.durationSec)) > D_MAX) { arr = arr.slice(0, -1); dropped++; }
    dSec.set(i, arr.length === 0 ? D_MIN : clamp(dialogueNeed(arr.map((c) => c.durationSec)), D_MIN, D_MAX));
    kept.push(...arr);
  });

  const D = [...dSec.values()].reduce((a, b) => a + b, 0);
  const nonD = screenplay.scenes.map((s, i) => ({ s, i })).filter((x) => x.s.type !== "dialogue");
  const floorSum = nonD.reduce((a, x) => a + (FLOORS[x.s.type] ?? 3), 0);
  const origSum = nonD.reduce((a, x) => a + x.s.targetSec, 0) || 1;
  const budget = total - D;
  if (budget < floorSum - 1e-6) return { ok: false, screenplay, lineCues, droppedLines: dropped };

  const targets = new Map<number, number>(dSec);
  let allocated = 0;
  for (const x of nonD) { const v = Math.max(FLOORS[x.s.type] ?? 3, budget * (x.s.targetSec / origSum)); targets.set(x.i, v); allocated += v; }
  if (Math.abs(D + allocated - total) > tol) return { ok: false, screenplay, lineCues, droppedLines: dropped };

  const resized: Screenplay = { ...screenplay, scenes: screenplay.scenes.map((s, i) => ({ ...s, targetSec: round2(targets.get(i) ?? s.targetSec) })) };
  const check = ScreenplaySchema.safeParse(resized);
  return check.success ? { ok: true, screenplay: check.data, lineCues: kept, droppedLines: dropped } : { ok: false, screenplay, lineCues, droppedLines: dropped };
}
