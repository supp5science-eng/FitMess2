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

export async function logMealAction(input: LogMealInput): Promise<LogMealResult> {
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

  const { error } = await supabase.from("logs").insert({
    user_id: userId,
    food_id: null,
    name,
    grams: round1(grams),
    kcal: Math.round(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    method: "meal",
  });

  if (error) {
    console.error("[F064 obrok] log insert failed:", error.message);
    return { ok: false, error_sr: "Nismo uspeli da sačuvamo unos. Pokušaj ponovo." };
  }

  return { ok: true };
}
