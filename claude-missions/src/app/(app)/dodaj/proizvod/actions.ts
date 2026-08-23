"use server";

import { estimateLabelFromImage } from "@/lib/ai/gemini";
import type { LabelEstimate } from "@/lib/ai/label-estimate";
import { chargeAiEstimate } from "@/lib/ai/quota";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// "Dodaj proizvod" flow: server action for the INLINE nutrition-label photo
// prefill inside `NewProductForm` (the same job the standalone
// `/dodaj/deklaracija` flow does, but here the extracted values land directly
// in the add-product form the user is already on). The photo is read by Gemini
// server-side, so the API key never reaches the client; auth-gated so an
// anonymous caller can never burn the paid vision API. Identical contract to
// `src/app/(app)/dodaj/deklaracija/actions.ts` -- kept as its own action here so
// this route owns its server surface rather than importing another route's.

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

  // One user action = one charge against the free daily allowance, taken here
  // rather than inside `gemini.ts` because a single action can make two model
  // calls and "five a day" has to mean five meals. Enforcement is OFF today --
  // this call is what measures demand (see `@/lib/ai/quota`).
  const quota = await chargeAiEstimate(supabase, userId);
  if (!quota.ok) return { ok: false, error_sr: quota.error_sr };

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
    console.error("[dodaj/proizvod] label estimate failed:", err);
    return {
      ok: false,
      error_sr:
        "Nismo uspeli da pročitamo deklaraciju. Uslikaj tabelu izbliza i pokušaj ponovo.",
    };
  }
}
