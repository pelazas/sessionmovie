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

/** Synthesize one utterance; resolves to MP3 bytes. */
export async function synthesize(text: string, config: TTSConfig): Promise<Buffer> {
  const response = await fetch(`${API_BASE}/text-to-speech/${config.voiceId}`, {
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
  });
  if (!response.ok) {
    // Response bodies are ElevenLabs error JSON — safe to surface (no key).
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`ElevenLabs TTS failed (HTTP ${response.status}): ${detail}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("ElevenLabs TTS returned an empty body");
  }
  return bytes;
}
