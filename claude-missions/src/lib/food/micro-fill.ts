import { estimateFoodMicros } from "@/lib/ai/micro-estimate";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Lazy micronutrient fill for ONE catalog food (0017).
 *
 * The curated catalog only ever had macros, so `scripts/backfill-food-micro.ts`
 * runs an AI pass over it once. This is the safety net for everything that
 * arrives afterwards -- a product a user created from a barcode scan or the
 * "novi proizvod" form -- so the four home-screen cards don't quietly lose
 * coverage the first time somebody logs a brand-new food.
 *
 * ## Why the caller should run this in `after()`, not inline
 *
 * Nobody waits for it. The log row is already saved, and the home screen renders
 * these numbers via `resolveLogMicros`, which falls back to the FOOD's per-100g
 * values when the log's own snapshot is null -- so filling the catalog row alone
 * is enough for the day's totals to become complete, no log rewrite needed (and
 * the snapshot convention in `0004_foods_logs.sql` forbids rewriting history
 * anyway). Worst case the numbers land a moment later than the meal.
 *
 * ## Why the admin client
 *
 * `foods` is a shared catalog with no UPDATE RLS policy (`0004_foods_logs.sql`):
 * rows are inserted by session-scoped users and only ever corrected by the
 * service-role client. This is a catalog correction, so it takes that path.
 *
 * Never throws and never returns a reason: every failure (no API key, timeout,
 * a nonsense answer, a concurrent writer) just leaves the row unfilled, which is
 * a state the whole micro pipeline already handles. Safe to call twice.
 */
export async function fillFoodMicrosIfMissing(foodId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    const { data: food, error } = await admin
      .from("foods")
      .select(
        "id, name_sr, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g"
      )
      .eq("id", foodId)
      .maybeSingle();

    if (error || !food) return false;
    // Already known (or filled by a concurrent caller since the read that
    // triggered this): nothing to pay for.
    if (food.fiber_100g !== null && food.fiber_100g !== undefined) return false;

    const estimate = await estimateFoodMicros({
      name: food.name_sr,
      brand: food.brand,
      kcal100g: food.kcal_100g,
      protein100g: food.protein_100g,
      carbs100g: food.carbs_100g,
      fat100g: food.fat_100g,
    });
    if (!estimate) return false;

    const { error: updateError } = await admin
      .from("foods")
      .update({
        fiber_100g: estimate.fiber_100g,
        sugar_100g: estimate.sugar_100g,
        sodium_100g: estimate.sodium_100g,
        sat_fat_100g: estimate.sat_fat_100g,
        micro_source: "ai",
      })
      .eq("id", foodId)
      // Don't overwrite a real declaration (or a concurrent fill) with an
      // estimate: only ever fill a row that is still unknown.
      .is("fiber_100g", null);

    if (updateError) {
      console.warn("[micro-fill] update failed:", updateError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[micro-fill] skipped:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}
