"use server";

import { z } from "zod";

import { aiErrorSr, estimateGricFromAudio } from "@/lib/ai/gemini";
import type { GricEstimate } from "@/lib/ai/gric-estimate";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Server actions for "Gric" (quick spoken logging of small stuff). The clip is
// sent to Gemini here so the API key never reaches the client, and the
// confirmed items are written as ordinary one-off log rows (`food_id: null`,
// method 'meal') — the same shape the photo and voice flows produce, so the
// home screen, Analitika and the retention job all handle them with no changes
// and no migration.

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB (16 kHz mono WAV clips are tiny)

export type GricEstimateResult =
  | { ok: true; data: GricEstimate }
  | { ok: false; error_sr: string };

export async function estimateGricAction(
  formData: FormData
): Promise<GricEstimateResult> {
  // Auth-gate before touching the paid audio API.
  const { t } = await getT();
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: t("dodaj.error.sessionExpired"),
    };
  }

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error_sr: t("dodaj.gric.error.noRecording") };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error_sr: t("dodaj.error.recordingTooLong") };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "audio/wav";

  try {
    const data = await estimateGricFromAudio(base64, mimeType);
    return { ok: true, data };
  } catch (err) {
    console.error("[gric] estimate failed:", err);
    return {
      ok: false,
      error_sr: aiErrorSr(err, t("dodaj.error.understandRecordingFailed")),
    };
  }
}

const gricLogItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.coerce.number().min(1).max(5000),
  kcal: z.coerce.number().min(0).max(6000),
  protein: z.coerce.number().min(0).max(800),
  carbs: z.coerce.number().min(0).max(800),
  fat: z.coerce.number().min(0).max(800),
});

// One spoken sentence can hold several snacks, but not a shopping list; the
// cap matches the model's own `stavke` limit.
const logGricSchema = z.array(gricLogItemSchema).min(1).max(8);

export type LogGricInput = z.input<typeof logGricSchema>;

export type LogGricResult =
  | { ok: true; saved: number }
  | { ok: false; error_sr: string };

/**
 * Writes every confirmed item as its own `logs` row, in ONE insert — the items
 * were spoken together, so they must land together: a partial save would leave
 * the user unsure what was recorded, which is exactly the doubt this feature
 * exists to remove.
 */
export async function logGricAction(
  input: LogGricInput
): Promise<LogGricResult> {
  const { t } = await getT();
  const parsed = logGricSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error_sr: t("dodaj.gric.error.invalidInput") };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: t("dodaj.error.sessionExpired"),
    };
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const rows = parsed.data.map((item) => ({
    user_id: userId,
    food_id: null,
    name: item.name,
    grams: round1(item.grams),
    kcal: Math.round(item.kcal),
    protein: round1(item.protein),
    carbs: round1(item.carbs),
    fat: round1(item.fat),
    method: "meal" as const,
  }));

  const { error } = await supabase.from("logs").insert(rows);
  if (error) {
    console.error("[gric] log insert failed:", error.message);
    return { ok: false, error_sr: t("dodaj.error.saveFailed") };
  }

  return { ok: true, saved: rows.length };
}
