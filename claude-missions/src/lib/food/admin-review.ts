import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Food } from "@/lib/types/db";

// F034 / AS-060 (the admin review queue lists unverified foods, newest
// first, submitter + label photo when present), AS-062 (marking a food
// verified flips verified=true and it leaves the queue), AS-063 (removing a
// food soft-deletes it so it no longer appears in search or barcode
// lookup, while existing logs referencing it keep their snapshot) -- the
// Supabase I/O wrapper backing `/admin/hrana`
// (src/app/admin/hrana/page.tsx) and its two mutation Route Handlers
// (src/app/api/admin/foods/[id]/verify, .../remove).
//
// Every function here takes an already-constructed Supabase client that
// MUST be the privileged service-role admin client
// (`createAdminClient()`, src/lib/supabase/server.ts) and MUST only ever be
// called from behind `requireAdmin()` (the page) or
// `resolveAdminSessionForClient` + `toAdminApiResult` (the Route Handlers,
// same reusable core F033 exported) -- there is deliberately no
// UPDATE/DELETE RLS policy on `public.foods` at all
// (0004_foods_logs.sql), so the admin client is the only way any of these
// three operations can ever succeed; enforcement lives in the gate, not in
// RLS, exactly per F033's own handoff notes.

export const FOOD_LIST_FAILED_ERROR_SR =
  "Nismo uspeli da učitamo red za proveru. Pokušaj ponovo.";
export const FOOD_NOT_FOUND_ERROR_SR = "Namirnica nije pronađena.";
export const FOOD_VERIFY_FAILED_ERROR_SR =
  "Nismo uspeli da potvrdimo namirnicu. Pokušaj ponovo.";
export const FOOD_REMOVE_FAILED_ERROR_SR =
  "Nismo uspeli da uklonimo namirnicu. Pokušaj ponovo.";

/** A queue row plus the submitter's email. `public.profiles` has no email
 * column (only `auth.users` does), so the email is looked up separately via
 * the admin Auth API. Null when the submission is anonymized
 * (`submitted_by` is null -- e.g. the submitter later deleted their
 * account, ON DELETE SET NULL per 0004_foods_logs.sql) or when the Auth
 * lookup itself fails (degrades gracefully -- a missing submitter email
 * never blocks the queue from rendering, AS-060). */
export interface AdminQueueFood extends Food {
  submitterEmail: string | null;
}

export interface ListUnverifiedFoodsResult {
  data: AdminQueueFood[] | null;
  error: { message: string } | null;
}

/**
 * Lists every `verified = false, is_removed = false` food, newest first
 * (AS-060) -- the `/admin/hrana` review queue's entire data source. A
 * removed food is never listed here, even if it was never verified: once
 * an admin pulls it, it is gone from the queue too (there is nothing left
 * to review).
 */
export async function listUnverifiedFoods(
  admin: SupabaseClient<Database>
): Promise<ListUnverifiedFoodsResult> {
  const { data, error } = await admin
    .from("foods")
    .select("*")
    .eq("verified", false)
    .eq("is_removed", false)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const withSubmitters = await Promise.all(
    (data ?? []).map(async (food) => ({
      ...food,
      submitterEmail: await lookupSubmitterEmail(admin, food.submitted_by),
    }))
  );

  return { data: withSubmitters, error: null };
}

async function lookupSubmitterEmail(
  admin: SupabaseClient<Database>,
  submittedBy: string | null
): Promise<string | null> {
  if (!submittedBy) return null;
  try {
    const { data, error } = await admin.auth.admin.getUserById(submittedBy);
    if (error || !data.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

export type AdminFoodMutationResult =
  | { ok: true; data: Food }
  | { ok: false; error_sr: string; status: 404 | 500 };

/**
 * Marks a food `verified = true` (AS-062) -- after this, the food's
 * "neprovereno" badge disappears everywhere it is shown (F024's
 * `FoodListItem` only renders the badge when `!food.verified`) and it drops
 * out of the review queue (`listUnverifiedFoods` above only ever selects
 * `verified = false`). Scoped to `is_removed = false` -- an already-removed
 * food is not a normal queue state (the queue never lists one), so
 * attempting to verify one resolves the same as "not found" rather than
 * silently reviving a pulled food.
 */
export async function verifyFood(
  admin: SupabaseClient<Database>,
  foodId: string
): Promise<AdminFoodMutationResult> {
  const { data, error } = await admin
    .from("foods")
    .update({ verified: true })
    .eq("id", foodId)
    .eq("is_removed", false)
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error_sr: FOOD_VERIFY_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    return { ok: false, error_sr: FOOD_NOT_FOUND_ERROR_SR, status: 404 };
  }
  return { ok: true, data };
}

/**
 * Soft-removes a food (AS-063): sets `is_removed = true` + `removed_at =
 * now()`. Never a hard DELETE -- `logs` rows referencing this food already
 * snapshot every value they display (name/grams/kcal/protein/carbs/fat,
 * 0004_foods_logs.sql's own "money-math"/snapshot convention), so a
 * removal never changes a user's historical log entries either way. A soft
 * delete is used anyway (per the clarified "PREFER a soft-delete" scope
 * note) so the row itself -- and any future admin undo/audit tooling built
 * on top of it -- survives, rather than relying solely on
 * `logs.food_id`'s own `ON DELETE SET NULL` as the only trace a removal
 * ever happened.
 *
 * `public.search_foods()` (`supabase/migrations/0006_foods_removal.sql`)
 * and `lookupFoodByBarcode` (`src/lib/food/barcode.ts`) both exclude
 * `is_removed = true` rows, so a removed food immediately stops appearing
 * in search results and barcode lookups the instant this update commits.
 */
export async function removeFood(
  admin: SupabaseClient<Database>,
  foodId: string
): Promise<AdminFoodMutationResult> {
  const { data, error } = await admin
    .from("foods")
    .update({ is_removed: true, removed_at: new Date().toISOString() })
    .eq("id", foodId)
    .eq("is_removed", false)
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error_sr: FOOD_REMOVE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    return { ok: false, error_sr: FOOD_NOT_FOUND_ERROR_SR, status: 404 };
  }
  return { ok: true, data };
}
