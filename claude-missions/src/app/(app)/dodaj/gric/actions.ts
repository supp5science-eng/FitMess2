"use server";

import { z } from "zod";

import { aiErrorSr, estimateGricFromAudio } from "@/lib/ai/gemini";
import type { GricEstimate } from "@/lib/ai/gric-estimate";
import { chargeAiEstimate } from "@/lib/ai/quota";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { buildGricRows } from "@/lib/gric/rows";
import { createClient } from "@/lib/supabase/server";

// Server actions for "Gric" (quick spoken logging of small stuff). The clip is
// sent to Gemini here so the API key never reaches the client, and the
// confirmed items are written as ordinary one-off log rows (`food_id: null`,
// method 'meal') — the same shape the photo and voice flows produce, so the
// home screen, Analitika and the retention job all handle them with no changes
// and no migration.
//
// Items are written per EATING OCCASION, not per item: what was eaten together
// becomes one row with its parts in `logs.components` (see
// `src/lib/gric/rows.ts`). The client sends the items with their occasion tag
// and the grouping is redone here — the row totals must be the sum of the parts
// the server itself computed, never numbers a client asserted.

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB (16 kHz mono WAV clips are tiny)

export type GricEstimateResult =
  | { ok: true; data: GricEstimate }
  | { ok: false; error_sr: string };

export async function estimateGricAction(
  formData: FormData
): Promise<GricEstimateResult> {
  // Auth-gate before touching the paid audio API.
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

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error_sr: "Nema snimka. Reci šta si gricnuo pa pokušaj ponovo." };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error_sr: "Snimak je predugačak. Pokušaj ponovo, kraće." };
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
      error_sr: aiErrorSr(err, "Nismo uspeli da razumemo snimak. Pokušaj ponovo."),
    };
  }
}

const gricLogItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Spoken amount ("2 komada", "šaka"); only used to derive the natural unit
   * of a breakdown line, never to compute a macro. */
  amount: z.string().trim().max(40).optional(),
  grams: z.coerce.number().min(1).max(5000),
  kcal: z.coerce.number().min(0).max(6000),
  protein: z.coerce.number().min(0).max(800),
  carbs: z.coerce.number().min(0).max(800),
  fat: z.coerce.number().min(0).max(800),
  /** Which eating occasion this item belongs to. Absent = its own occasion. */
  group: z.coerce.number().int().min(0).max(31).optional(),
});

// One spoken sentence can hold several snacks, but not a shopping list; the
// cap matches the model's own `stavke` limit.
const logGricSchema = z.array(gricLogItemSchema).min(1).max(8);

export type LogGricInput = z.input<typeof logGricSchema>;

export type LogGricResult =
  | { ok: true; saved: number }
  | { ok: false; error_sr: string };

/**
 * Writes one `logs` row per eating occasion, in ONE insert — the items were
 * spoken together, so they must land together: a partial save would leave the
 * user unsure what was recorded, which is exactly the doubt this feature exists
 * to remove.
 */
export async function logGricAction(
  input: LogGricInput
): Promise<LogGricResult> {
  const parsed = logGricSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error_sr: "Neispravan unos. Pokušaj ponovo." };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const rows = buildGricRows(parsed.data).map((row) => ({
    user_id: userId,
    food_id: null,
    name: row.name,
    grams: row.grams,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    // The breakdown is what keeps a joined occasion editable: "Dodaj još" and
    // "Nisam sve pojeo" both work off these lines.
    components: row.components,
    method: "meal" as const,
  }));

  const { error } = await supabase.from("logs").insert(rows);
  if (error) {
    console.error("[gric] log insert failed:", error.message);
    return { ok: false, error_sr: "Nismo uspeli da sačuvamo unos. Pokušaj ponovo." };
  }

  return { ok: true, saved: rows.length };
}
