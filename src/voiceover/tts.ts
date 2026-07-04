/**
 * ElevenLabs text-to-speech over plain fetch — no SDK dependency.
 *
 * The API key is read ONLY from process.env.ELEVENLABS_API_KEY, is never
 * logged, and never appears in any thrown error. Voiceover is opt-in
 * (docs/audio.md): all synthesis happens in the CLI pre-render step, never
 * inside compositions.
 */

/** George — a current ElevenLabs default premade voice; measured, deadpan. */
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
/** Current fast/cheap tier (≈half credit cost per character vs multilingual v2). */
export const DEFAULT_MODEL = "eleven_flash_v2_5";

const API_BASE = "https://api.elevenlabs.io/v1";
const REQUEST_TIMEOUT_MS = 60_000;

export interface TTSConfig {
  apiKey: string;
  voiceId: string;
  model: string;
  /** Stable synthesis settings — part of the cache key. */
  settings: {
    stability: number;
    similarity_boost: number;
  };
}

/** Build config from the environment, or undefined when no key is set. */
export function ttsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TTSConfig | undefined {
  const apiKey = env["ELEVENLABS_API_KEY"];
  if (!apiKey) return undefined;
  return {
    apiKey,
    voiceId: env["ELEVENLABS_VOICE_ID"] ?? DEFAULT_VOICE_ID,
    model: env["ELEVENLABS_MODEL"] ?? DEFAULT_MODEL,
    settings: { stability: 0.5, similarity_boost: 0.75 },
  };
}

const KEY_CHECK_TIMEOUT_MS = 10_000;

export type ApiKeyCheckResult =
  | { ok: true }
  | { ok: false; kind: "invalid" | "unavailable"; detail: string };

/**
 * Validate an API key with the cheapest authenticated call (GET /v1/voices) so
 * `doctor` can reject a bad key before a render instead of mid-render. 401/403
 * mean the key is bad; anything else (network, 5xx) is ElevenLabs being
 * unavailable, which is not the user's key's fault.
 */
export async function checkApiKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiKeyCheckResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE}/voices`, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The key must never surface, even via an exotic error message.
    const detail = message.replaceAll(apiKey, "***");
    return { ok: false, kind: "unavailable", detail };
  }
  if (response.ok) return { ok: true };
  const kind = response.status === 401 || response.status === 403 ? "invalid" : "unavailable";
  return { ok: false, kind, detail: `HTTP ${response.status}` };
}

import type { CharacterAlignment } from "./types.js";
export type { CharacterAlignment } from "./types.js";

export interface SynthesisResult {
  audio: Buffer;
  /** null if the API ever omits alignment — callers degrade to no-highlight. */
  alignment: CharacterAlignment | null;
}

/**
 * Synthesize one utterance via the with-timestamps endpoint; resolves to MP3
 * bytes plus character timestamps (measured narration is reality — captions
 * sync to these, docs/audio.md).
 */
export async function synthesizeWithTimestamps(
  text: string,
  config: TTSConfig,
): Promise<SynthesisResult> {
  const response = await fetch(
    `${API_BASE}/text-to-speech/${config.voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: config.model,
        voice_settings: config.settings,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    // Response bodies are ElevenLabs error JSON — safe to surface (no key).
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`ElevenLabs TTS failed (HTTP ${response.status}): ${detail}`);
  }
  const payload = (await response.json().catch(() => null)) as {
    audio_base64?: string;
    alignment?: CharacterAlignment | null;
  } | null;
  if (!payload?.audio_base64) {
    throw new Error("ElevenLabs TTS returned no audio_base64 body");
  }
  const audio = Buffer.from(payload.audio_base64, "base64");
  if (audio.length === 0) {
    throw new Error("ElevenLabs TTS returned an empty audio payload");
  }
  return { audio, alignment: payload.alignment ?? null };
}
