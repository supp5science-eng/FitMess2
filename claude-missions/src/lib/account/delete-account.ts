import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

/**
 * F019 / AS-015, AS-016: self-serve account deletion core.
 *
 * Deliberately built around a SINGLE mutating call --
 * `admin.auth.admin.deleteUser(userId)` -- which GoTrue executes against
 * Postgres as one `DELETE FROM auth.users WHERE id = ...`, and every
 * personal-data table so far (`public.profiles`, `public.targets`, both
 * `references auth.users (id) on delete cascade` -- see
 * `supabase/migrations/0001_profiles.sql`) is removed by the database's own
 * FK cascade in that same transaction. That single atomic delete is what
 * actually satisfies the clarified "no partial writes" failure-handling
 * answer: if it fails, NOTHING was touched at all (not even a partial wipe
 * of `profiles`/`targets` while the auth user survives) -- the account is
 * left exactly as it was, and the caller shows a Serbian retry error.
 *
 * The clarified spec also asks the deletion to be "explicit/defensive"
 * about the personal-data rows, not just trust the cascade blindly --
 * `cleanupResidualRows` below reads `targets`/`profiles` back AFTER a
 * successful `deleteUser` and explicitly deletes anything that (should be
 * structurally impossible, given the FK cascade) survived, logging loudly
 * if it ever does. This never runs before `deleteUser` succeeds, so it can
 * never itself create a "some rows gone, auth user still active" partial
 * state.
 */

export class AccountDeletionError extends Error {}

export type DeleteAccountResult = { ok: true } | { ok: false; error_sr: string };

export const ACCOUNT_DELETE_FAILED_ERROR_SR =
  "Nije uspelo brisanje naloga. Pokušaj ponovo ili nam se javi.";

/**
 * Deletes `userId`'s auth account and every personal-data row that
 * references it. `admin` MUST be a privileged (`sb_secret_`) client --
 * `auth.admin.deleteUser` does not exist on a session-bound client, and the
 * caller (the route handler) is responsible for first proving `userId` IS
 * the currently authenticated caller's own id via a session-bound client's
 * `auth.getUser()` before ever calling this function (AS-015's "own account
 * only" guarantee lives at that call site, not here -- this function trusts
 * whatever id it is given, exactly like `collectUserExport` trusts its
 * caller for the same reason, see `src/lib/export/user-data.ts`).
 */
export async function deleteAccount(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<DeleteAccountResult> {
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error(
      `[F019 account-delete] admin.auth.admin.deleteUser failed for user ${userId}:`,
      deleteUserError.message
    );
    return { ok: false, error_sr: ACCOUNT_DELETE_FAILED_ERROR_SR };
  }

  await cleanupResidualRows(admin, userId);

  return { ok: true };
}

async function cleanupResidualRows(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { data: residualTargets, error: targetsReadError } = await admin
    .from("targets")
    .select("id")
    .eq("user_id", userId);

  if (targetsReadError) {
    console.error(
      `[F019 account-delete] post-delete residual-row check on targets failed for ${userId}:`,
      targetsReadError.message
    );
  } else if (residualTargets && residualTargets.length > 0) {
    console.error(
      `[F019 account-delete] ${residualTargets.length} residual targets row(s) survived the auth-user delete cascade for ${userId} -- deleting explicitly (schema-cascade anomaly, should not happen).`
    );
    await admin.from("targets").delete().eq("user_id", userId);
  }

  const { data: residualProfile, error: profileReadError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileReadError) {
    console.error(
      `[F019 account-delete] post-delete residual-row check on profiles failed for ${userId}:`,
      profileReadError.message
    );
  } else if (residualProfile) {
    console.error(
      `[F019 account-delete] a residual profiles row survived the auth-user delete cascade for ${userId} -- deleting explicitly (schema-cascade anomaly, should not happen).`
    );
    await admin.from("profiles").delete().eq("user_id", userId);
  }
}
