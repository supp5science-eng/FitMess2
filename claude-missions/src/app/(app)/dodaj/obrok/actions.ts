"use server";

import { z } from "zod";

import { estimateMealFromImage } from "@/lib/ai/gemini";
import type { MealEstimate } from "@/lib/ai/meal-estimate";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// F064 (MVP): server actions for the meal-photo flow. The photo is sent to
// Gemini here (server-side, so the API key never reaches the client) and the
// confirmed estimate is written as a one-off `logs` row (`food_id: null`,
// method 'meal') -- a meal snapshot never pollutes the shared foods catalog.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (client already downscales)

export type EstimateResult =
  | { ok: true; data: MealEstimate }
  | { ok: false; error_sr: string };

export async function estimateMealAction(
  formData: FormData
): Promise<EstimateResult> {
  // Auth-gate before touching the paid vision API.
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
    return { ok: false, error_sr: "Nema slike. Slikaj obrok pa pokušaj ponovo." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error_sr: "Slika je prevelika. Pokušaj ponovo." };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";

  try {
    const data = await estimateMealFromImage(base64, mimeType);
    return { ok: true, data };
  } catch (err) {
    console.error("[F064 obrok] estimate failed:", err);
    return {
      ok: false,
      error_sr: "Nismo uspeli da procenimo obrok. Pokušaj ponovo.",
    };
  }
}

const logMealSchema = z.object({
  name: z.string().trim().min(1, "Unesi naziv obroka.").max(120),
  grams: z.coerce.number().min(1).max(5000),
  kcal: z.coerce.number().min(0).max(6000),
  protein: z.coerce.number().min(0).max(800),
  carbs: z.coerce.number().min(0).max(800),
  fat: z.coerce.number().min(0).max(800),
});

export type LogMealInput = z.input<typeof logMealSchema>;

export type LogMealResult =
  | { ok: true }
  | { ok: false; error_sr: string };

/**
 * Optional display photo for the "Slikaj obrok" flow: a small client-downscaled
 * JPEG thumbnail, base64-encoded (no `data:` prefix). Stored in `meal_photos`
 * so it can be shown on today's meal list, then pruned after ~1 day (the log's
 * macros survive). The voice flow (`glas-flow.tsx`) calls `logMealAction`
 * WITHOUT this, so it stays optional and backward-compatible.
 */
export interface MealPhotoInput {
  base64: string;
  mimeType?: string;
}

// ~900 KB decoded ceiling for the stored thumbnail (base64 is ~4/3 the bytes).
// The client downscales to ~720px/q0.72 (tens of KB); anything wildly larger is
// dropped rather than stored, and the meal still saves without a photo.
const MAX_PHOTO_BASE64_LEN = 1_200_000;

export async function logMealAction(
  input: LogMealInput,
  photo?: MealPhotoInput
): Promise<LogMealResult> {
  const parsed = logMealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error_sr: "Neispravan unos. Proveri vrednosti." };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const { name, grams, kcal, protein, carbs, fat } = parsed.data;

  const { data: inserted, error } = await supabase
    .from("logs")
    .insert({
      user_id: userId,
      food_id: null,
      name,
      grams: round1(grams),
      kcal: Math.round(kcal),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      method: "meal",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[F064 obrok] log insert failed:", error?.message);
    return { ok: false, error_sr: "Nismo uspeli da sačuvamo unos. Pokušaj ponovo." };
  }

  // Store the photo BEST-EFFORT: it's an enhancement, never a reason to fail a
  // successfully-logged meal. A missing `meal_photos` table, an oversized blob,
  // or an insert error all just mean "meal saved, no photo."
  if (photo && photo.base64 && photo.base64.length <= MAX_PHOTO_BASE64_LEN) {
    const { error: photoError } = await supabase.from("meal_photos").insert({
      log_id: inserted.id,
      user_id: userId,
      image_base64: photo.base64,
      mime_type: photo.mimeType ?? "image/jpeg",
    });
    if (photoError) {
      console.warn("[F064 obrok] meal photo insert skipped:", photoError.message);
    }
  }

  return { ok: true };
}
