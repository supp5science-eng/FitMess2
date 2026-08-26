"use server";

import { aiErrorSr, transcribeSpeech } from "@/lib/ai/gemini";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// Prizma's ear (glasovni razgovor, 2026-08-26): the spoken clip comes here,
// Gemini writes down the sentence, and the CLIENT then sends that sentence
// through the ordinary `/api/ai/agent` turn — so voice and typing are the
// same conversation, with the same history, quota and action cards.
//
// Deliberately NOT charged against the AI allowance here: one spoken message
// is ONE user action, and the agent turn it feeds already takes the one
// charge (same stance as Gric, where a single action may make two model
// calls but costs one estimate).

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB (16 kHz mono WAV clips are tiny)

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error_sr: string };

/** One spoken clip -> the user's sentence, verbatim. */
export async function transcribeVoiceAction(
  formData: FormData
): Promise<TranscribeResult> {
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error_sr: "Nema snimka. Probaj ponovo.",
    };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      error_sr: "Snimak je predugačak. Probaj ponovo, kraće.",
    };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo.",
    };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "audio/wav";

  try {
    const text = await transcribeSpeech(base64, mimeType);
    if (!text) {
      return {
        ok: false,
        error_sr: "Nisam te čula. Probaj ponovo, malo glasnije.",
      };
    }
    return { ok: true, text };
  } catch (err) {
    console.error("[/ai] transcription failed:", err);
    return {
      ok: false,
      error_sr: aiErrorSr(err, "Nismo uspeli da razumemo snimak. Probaj ponovo."),
    };
  }
}
