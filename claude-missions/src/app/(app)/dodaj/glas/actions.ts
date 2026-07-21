"use server";

import { estimateMealFromAudio } from "@/lib/ai/gemini";
import type { VoiceMealEstimate } from "@/lib/ai/voice-estimate";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// "Reci obrok" (M7): the user speaks about what they ate/drank, the clip is
// sent to Gemini here (server-side, so the API key never reaches the client),
// and the confirmed estimate is written as a one-off meal log. The actual write
// reuses `logMealAction` from the meal-photo flow -- a spoken meal and a
// photographed meal are the same `logs` row (`food_id: null`, method 'meal') --
// which the flow imports directly (a "use server" module may only export async
// server actions, so we can't re-export it from here).

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB (16 kHz mono WAV clips are tiny)

export type VoiceEstimateResult =
  | { ok: true; data: VoiceMealEstimate }
  | { ok: false; error_sr: string };

export async function estimateVoiceMealAction(
  formData: FormData
): Promise<VoiceEstimateResult> {
  // Auth-gate before touching the paid audio API.
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error_sr: "Nema snimka. Snimi obrok pa pokušaj ponovo.",
    };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error_sr: "Snimak je predugačak. Pokušaj ponovo, kraće." };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "audio/wav";

  try {
    const data = await estimateMealFromAudio(base64, mimeType);
    return { ok: true, data };
  } catch (err) {
    console.error("[glas] voice estimate failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da razumemo snimak. Pokušaj ponovo.",
    };
  }
}
