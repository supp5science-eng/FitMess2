// Prizma's real mouth (2026-08-26): ElevenLabs TTS, server-side.
//
// The agreed pipeline: Gemini LISTENS (transcribeSpeech), the agent model
// WRITES (claude.ts / gemini.ts), ElevenLabs SPEAKS — this module is only
// the third verb. `eleven_v3` is the one model with Serbian (Flash v2.5 /
// Multilingual v2 top out at Croatian), so it is the default; both the model
// and the voice are env-overridable because the voice casting session
// (v3 srpski vs Flash hrvatski × muški glasovi) is still ahead of us —
// recasting the voice must be a config change, never a deploy.
//
// NEVER import this from a client component — it reads `ELEVENLABS_API_KEY`.
// The system-TTS fallback (`src/lib/audio/speak.ts`) stays: no key, no
// network, or an API error must degrade to the old mouth, not to silence.

/** Docs' own example voice (George) — a male placeholder until the casting
 * session picks Prizma's real voice. Override via `ELEVENLABS_VOICE_ID`. */
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_v3";

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

/** Whether the route may offer the ElevenLabs mouth at all. */
export function hasElevenKey(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

/**
 * One reply -> one MP3 (44.1 kHz, 128 kbps — replies are 2-5 sentences, so
 * quality wins over bytes). Throws `ElevenLabsError` on any failure; the
 * route turns that into a signal for the client to fall back to system TTS.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new ElevenLabsError("ELEVENLABS_API_KEY is not set");

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_MODEL_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: modelId }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ElevenLabsError(
      `ElevenLabs TTS failed (${response.status}): ${body.slice(0, 300)}`,
      response.status
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
