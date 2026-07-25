"use server";

import { aiErrorSr, estimateLabelFromImage } from "@/lib/ai/gemini";
import type { LabelEstimate } from "@/lib/ai/label-estimate";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// F063 (MVP): server action for the nutrition-label photo flow. The photo is
// read by Gemini here (server-side, so the API key never reaches the client)
// and returned as per-100g values that pre-fill the existing "novi proizvod"
// form. Auth-gated so an anonymous caller can never burn the paid vision API.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (client already downscales)

export type LabelResult =
  | { ok: true; data: LabelEstimate }
  | { ok: false; error_sr: string };

export async function estimateLabelAction(
  formData: FormData
): Promise<LabelResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const file = formData.get("slika");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error_sr: "Nema slike. Slikaj deklaraciju pa pokušaj ponovo.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error_sr: "Slika je prevelika. Pokušaj ponovo." };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";

  try {
    const data = await estimateLabelFromImage(base64, mimeType);
    return { ok: true, data };
  } catch (err) {
    console.error("[F063 deklaracija] estimate failed:", err);
    return {
      ok: false,
      error_sr: aiErrorSr(
        err,
        "Nismo uspeli da pročitamo deklaraciju. Uslikaj tabelu izbliza i pokušaj ponovo."
      ),
    };
  }
}
