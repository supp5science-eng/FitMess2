"use server";

import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import { estimateMealFromImageAndVoice } from "@/lib/ai/gemini";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// "Najtačniji unos": server action for the combined photo + voice/text flow.
// Both the image and the spoken/typed description are sent to Gemini here
// (server-side, so the API key never reaches the client) in one multimodal
// request. Saving reuses `logMealAction` from the meal-photo flow (same one-off
// `logs` row, method 'meal', optional stored thumbnail) -- not duplicated here.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (client already downscales)
const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // ~60s mono 16kHz WAV is well under this
const MAX_NOTE_LEN = 1000;

export type CombinedEstimateResult =
  | { ok: true; data: CombinedMealEstimate }
  | { ok: false; error_sr: string };

export async function estimateCombinedAction(
  formData: FormData
): Promise<CombinedEstimateResult> {
  // Auth-gate before touching the paid vision/audio API.
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const image = formData.get("slika");
  if (!(image instanceof File) || image.size === 0) {
    return { ok: false, error_sr: "Nema slike. Slikaj obrok pa pokušaj ponovo." };
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return { ok: false, error_sr: "Slika je prevelika. Pokušaj ponovo." };
  }

  const audio = formData.get("audio");
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
  if (audioFile && audioFile.size > MAX_AUDIO_BYTES) {
    return { ok: false, error_sr: "Snimak je prevelik. Snimi kraće pa pokušaj ponovo." };
  }

  const noteRaw = formData.get("opis");
  const note =
    typeof noteRaw === "string" ? noteRaw.trim().slice(0, MAX_NOTE_LEN) : "";

  // The description (voice or text) is required -- it's the whole point of this
  // higher-accuracy path.
  if (!audioFile && !note) {
    return {
      ok: false,
      error_sr: "Dodaj opis — reci ili napiši šta si pojeo i koliko.",
    };
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const imageMime = image.type || "image/jpeg";

  let audioPart: { base64: string; mimeType: string } | null = null;
  if (audioFile) {
    audioPart = {
      base64: Buffer.from(await audioFile.arrayBuffer()).toString("base64"),
      mimeType: audioFile.type || "audio/wav",
    };
  }

  try {
    const data = await estimateMealFromImageAndVoice(
      { base64: imageBase64, mimeType: imageMime },
      audioPart,
      note || null
    );
    return { ok: true, data };
  } catch (err) {
    console.error("[najtacnije] combined estimate failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da procenimo obrok. Pokušaj ponovo.",
    };
  }
}
