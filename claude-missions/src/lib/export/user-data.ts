/**
 * F018: GDPR self-serve data export (AS-014).
 *
 * Framework-free core: takes an already session-bound (RLS) Supabase client
 * plus the current user's id/email and returns a single JSON-serializable
 * object containing everything currently stored about that user. Kept
 * separate from `src/app/api/export/route.ts` (the thin GET handler) for the
 * same reason F011/F016/F017 extract their core logic -- directly testable
 * against a live signed-in client without needing a running Next server.
 *
 * Every read here goes through the CALLER's session-bound client, never an
 * admin client -- Postgres' own-row RLS policies (AS-013) are what actually
 * guarantee a user can only ever read their own rows, not application code
 * alone. `collectUserExport` never accepts or constructs an elevated client.
 *
 * --- EXTENSION POINT ---------------------------------------------------
 * `USER_OWNED_TABLES` below is the single list of "many-row, `user_id`-
 * filtered" tables folded into the export. `profiles` (a single row per
 * user, holding both core profile fields AND the F017 `rules` jsonb array)
 * is handled separately in `loadProfileAndRules` since it isn't a
 * `user_id`-filtered *list* like the others. As later milestones land new
 * user-owned tables, append ONE entry here -- nothing else in this file
 * needs to change:
 *
 *   M3 logs                        -> { key: "logs", table: "logs", userColumn: "user_id", labelSr: "dnevni unosi hrane" }
 *   M5 weigh_ins                   -> { key: "weighIns", table: "weigh_ins", userColumn: "user_id", labelSr: "merenja težine" }
 *   M6 conversations / summaries   -> { key: "conversations", table: "conversations", userColumn: "user_id", labelSr: "razgovori sa agentom i sažeci" }
 *   vision: user-submitted foods   -> { key: "customFoods", table: "foods", userColumn: "created_by", labelSr: "sopstvene namirnice" }
 *
 * If a future table needs a shape other than "select * where <userColumn> =
 * userId" (e.g. a join, a computed/derived field), give it its own loader
 * function next to `loadProfileAndRules` below instead of forcing it into
 * this generic list.
 * -------------------------------------------------------------------------
 *
 * F020 wired the first of these in: `logs` (M3 manual food logging) is now
 * appended below. `foods` is deliberately NOT added here -- it is a SHARED
 * catalog table (not `user_id`-filtered; see
 * `supabase/migrations/0004_foods_logs.sql`), so it is never part of any
 * individual user's export, matching the same "shared, not personal data"
 * reasoning as `submitted_by` being anonymized (not deleted) on account
 * deletion (`src/lib/account/delete-account.ts`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EatingRuleJson } from "@/lib/types/db";

/** Thrown when any section of the export fails to read -- callers must
 * treat this as "the whole export failed", never return a partially-built
 * object (mirrors the "no partial writes" failure-handling convention for
 * this read path). */
export class ExportReadError extends Error {}

/** Every table in the schema whose Row shape includes a `user_id` column --
 * e.g. NOT `foods` (shared catalog, keyed by `submitted_by` instead). Narrowing
 * `UserOwnedTableConfig.table` to this (rather than the full `keyof Tables`)
 * is what keeps `.eq("user_id", ...)` below type-checking as more tables
 * land in `Database`: TS computes `keyof` over a union of Row types as the
 * INTERSECTION of their keys, so a single non-`user_id` table anywhere in
 * `keyof Database["public"]["Tables"]` would silently widen/break every
 * `.eq(config.userColumn, ...)` call in the loop below. */
type TableWithUserId = {
  [K in keyof Database["public"]["Tables"]]: Database["public"]["Tables"][K]["Row"] extends {
    user_id: string;
  }
    ? K
    : never;
}[keyof Database["public"]["Tables"]];

type UserOwnedTableConfig = {
  key: string;
  table: TableWithUserId;
  userColumn: "user_id";
  labelSr: string;
};

/** See "EXTENSION POINT" doc comment above. */
const USER_OWNED_TABLES: readonly UserOwnedTableConfig[] = [
  {
    key: "targets",
    table: "targets",
    userColumn: "user_id",
    labelSr: "ciljevi ishrane (istorija)",
  },
  {
    key: "logs",
    table: "logs",
    userColumn: "user_id",
    labelSr: "dnevni unosi hrane",
  }, // M3 (F020)
  // --- Extension point: append future user-owned tables here as they land ---
  // { key: "weighIns", table: "weigh_ins", userColumn: "user_id", labelSr: "merenja težine" }, // M5
  // { key: "conversations", table: "conversations", userColumn: "user_id", labelSr: "razgovori sa agentom i sažeci" }, // M6
];

const PROFILE_LABEL_SR = "profil (lični podaci i podešavanja)";
const RULES_LABEL_SR = "pravila ishrane";

export type UserExportAccount = { id: string; email: string | null };

export type UserExport = {
  exported_at: string;
  schema_note: string;
  account: UserExportAccount;
  profile: Record<string, unknown> | null;
  rules: EatingRuleJson[];
  /** `targets`, and future sections appended via `USER_OWNED_TABLES`. */
  [key: string]: unknown;
};

async function loadProfileAndRules(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ profile: Record<string, unknown> | null; rules: EatingRuleJson[] }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ExportReadError(`Failed to read profile for export: ${error.message}`);
  }
  if (!data) {
    return { profile: null, rules: [] };
  }

  // `rules` is surfaced as its own top-level export key (see below), not
  // duplicated inside `profile`.
  const { rules, ...profile } = data;
  return { profile, rules: rules ?? [] };
}

/**
 * Builds the complete GDPR export object for `userId`. `supabase` MUST be a
 * session-bound (RLS) client already scoped to `userId` -- this function
 * never elevates privileges and never accepts an admin client, and every
 * query below is additionally filtered to `userId` even though RLS alone
 * would already enforce that (defense in depth, same posture as
 * `updateRules`/`persistOnboarding`).
 *
 * Throws `ExportReadError` (never returns a partially-populated object) if
 * any section fails to read, so a caller never silently ships a truncated
 * export.
 */
export async function collectUserExport(
  supabase: SupabaseClient<Database>,
  account: UserExportAccount
): Promise<UserExport> {
  const userId = account.id;
  const { profile, rules } = await loadProfileAndRules(supabase, userId);

  const sections: Record<string, unknown> = {};
  const includedLabels: string[] = [PROFILE_LABEL_SR, RULES_LABEL_SR];

  for (const config of USER_OWNED_TABLES) {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq(config.userColumn, userId);

    if (error) {
      throw new ExportReadError(
        `Failed to read ${config.table} for export: ${error.message}`
      );
    }

    sections[config.key] = data ?? [];
    includedLabels.push(config.labelSr);
  }

  return {
    exported_at: new Date().toISOString(),
    schema_note:
      `Ovaj izvoz sadrži sledeće kategorije tvojih podataka: ${includedLabels.join(", ")}. ` +
      "Ne sadrži podatke drugih korisnika. Kako aplikacija bude dodavala nove vrste " +
      "podataka (npr. dnevni unosi hrane, merenja težine, razgovori sa agentom), " +
      "biće automatski uključene u ovaj izvoz.",
    account,
    profile,
    rules,
    ...sections,
  };
}
