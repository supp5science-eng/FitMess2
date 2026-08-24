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

/** See "EXTENSION POINT" doc comment above.
 *
 * Keeping this list current is the whole feature: the export's own
 * `schema_note` promises the user "everything we store about you", so a table
 * that lands without being appended here turns that promise into a false
 * statement. Everything user-owned in `Database` is listed below -- when a new
 * user-owned table lands, it belongs here in the same commit. */
const USER_OWNED_TABLES: readonly UserOwnedTableConfig[] = [
  {
    // The user's own statements about their own days ("Da, bio je lagan dan").
    // They lived in a cookie until 2026-08-06 and were missing from the export
    // for exactly as long -- see `supabase/migrations/0029_day_answers.sql`.
    key: "dayAnswers",
    table: "day_answers",
    userColumn: "user_id",
    labelSr: "odgovori o danima",
  },
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
  {
    key: "weighIns",
    table: "weigh_ins",
    userColumn: "user_id",
    labelSr: "merenja težine",
  }, // F042
  {
    key: "waterIntake",
    table: "water_intake",
    userColumn: "user_id",
    labelSr: "unos vode po danima",
  },
  {
    key: "stepCounts",
    table: "step_counts",
    userColumn: "user_id",
    labelSr: "koraci po danima",
  },
  {
    key: "habitChecks",
    table: "habit_checks",
    userColumn: "user_id",
    labelSr: "čekirane navike po danima",
  },
  {
    // 0032. Both land here the day they are created, not the day someone
    // notices: what a user paid for and how much of the app they used are
    // exactly the kind of records "sve što čuvamo o tebi" has to cover.
    key: "entitlements",
    table: "entitlements",
    userColumn: "user_id",
    labelSr: "pretplata",
  },
  {
    key: "aiUsage",
    table: "ai_usage",
    userColumn: "user_id",
    labelSr: "iskorišćene AI procene po danima",
  },
  {
    key: "reminderSettings",
    table: "reminder_settings",
    userColumn: "user_id",
    labelSr: "podešavanja podsetnika",
  }, // 0021 (Podsetnici)
  {
    key: "awards",
    table: "awards",
    userColumn: "user_id",
    labelSr: "osvojene značke po danima",
  }, // 0022 (Nagrade)
  {
    key: "planAdjustments",
    table: "plan_adjustments",
    userColumn: "user_id",
    labelSr: "predlozi korekcije plana i tvoji odgovori",
  }, // 0024 (Nedeljno merenje)
  {
    key: "workouts",
    table: "workouts",
    userColumn: "user_id",
    labelSr: "treninzi po danima",
  }, // 0026 (Trening)
  {
    key: "funnelEvents",
    table: "funnel_events",
    userColumn: "user_id",
    labelSr: "kada si prvi put stigao do pojedinih koraka u aplikaciji",
  }, // 0028 (merenje levka)
  // `push_subscriptions` is deliberately NOT exported: its rows are live device
  // CREDENTIALS (endpoint + p256dh/auth keys), not something the user told us
  // about themselves. Putting them in a downloadable file only creates a way to
  // leak them; the setting that matters (`reminder_settings`) is right above.
  // --- Extension point: append future user-owned tables here as they land ---
  // { key: "conversations", table: "conversations", userColumn: "user_id", labelSr: "razgovori sa agentom i sažeci" }, // M6
];

const PROFILE_LABEL_SR = "profil (lični podaci i podešavanja)";
const RULES_LABEL_SR = "navike";
const MEAL_PHOTOS_LABEL_SR = "slike obroka (podaci o slikama, bez same slike)";
const KLON_LABEL_SR = "tvoj klon (sam crtež)";

/** A table listed above that hasn't been migrated onto this environment yet must
 * not cost the user their whole export -- that section is reported as
 * unavailable instead (see `UserExport.missing_sections`). Any OTHER read error
 * still fails the export loudly, because it means we could not read data that
 * IS there.
 *
 * TWO codes, and the second one is the one that actually happens. `42P01` is
 * Postgres' own "relation does not exist" -- but a query through Supabase never
 * reaches Postgres to earn it. PostgREST resolves table names against its own
 * schema cache first and answers 404 `PGRST205` ("Could not find the table
 * 'public.x' in the schema cache") without opening a connection.
 *
 * Verified against the live project on 2026-08-13, after `funnel_events` was
 * added to the list above while migration 0028 sat unapplied: every user's
 * export -- JSON and PDF both -- failed with "Nismo uspeli", because this guard
 * was watching for a code that cannot arrive. The tolerance was written and
 * tested, and was dead on the only path that runs in production. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

function isMissingTable(error: { code?: string | null }): boolean {
  return error.code != null && MISSING_TABLE_CODES.has(error.code);
}

export type UserExportAccount = { id: string; email: string | null };

export type UserExport = {
  exported_at: string;
  schema_note: string;
  /** Sections whose table isn't present in this environment yet (see
   * `UNDEFINED_TABLE_CODE`). Empty on a healthy database -- listed explicitly
   * so an export is never quietly short of a category. */
  missing_sections: string[];
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
 * Meal photos, WITHOUT the image bytes.
 *
 * `meal_photos.image_base64` holds the picture inline (see
 * `0014_meal_photos.sql`), and a handful of them would turn a text export into
 * a multi-megabyte file built entirely in the serverless function's memory.
 * The rows themselves (which log, when, what type) are exported so nothing is
 * hidden; the pictures are deliberately short-lived anyway -- a scheduled job
 * deletes them after about a day, and the meal's nutrition data survives on
 * the log row.
 */
async function loadMealPhotoMetadata(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ rows: unknown[]; missing: boolean }> {
  const { data, error } = await supabase
    .from("meal_photos")
    .select("log_id, mime_type, created_at")
    .eq("user_id", userId);

  if (error) {
    if (isMissingTable(error)) return { rows: [], missing: true };
    throw new ExportReadError(
      `Failed to read meal_photos for export: ${error.message}`
    );
  }

  return { rows: data ?? [], missing: false };
}

/**
 * The klon, INCLUDING the picture -- the opposite call to the one made for meal
 * photos just above, and for the opposite reasons.
 *
 * A meal photo is one of hundreds, lives about a day, and its useful content
 * (the nutrition) survives on the log row, so shipping the bytes would bloat
 * the file for nothing. A klon is exactly one image, it is permanent, and the
 * picture IS the data -- an export that described it without handing it over
 * would be a portability right that ports nothing.
 *
 * The source photos it was drawn from are not here because they are nowhere:
 * they are discarded the moment the drawing comes back (see
 * `0033_avatar_clones.sql`).
 */
async function loadKlon(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ row: unknown | null; missing: boolean }> {
  const { data, error } = await supabase
    .from("avatar_clones")
    .select("image_base64, mime_type, prompt_version, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return { row: null, missing: true };
    throw new ExportReadError(
      `Failed to read avatar_clones for export: ${error.message}`
    );
  }

  return { row: data ?? null, missing: false };
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
  const missingSections: string[] = [];

  for (const config of USER_OWNED_TABLES) {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq(config.userColumn, userId);

    if (error) {
      if (isMissingTable(error)) {
        missingSections.push(config.labelSr);
        continue;
      }
      throw new ExportReadError(
        `Failed to read ${config.table} for export: ${error.message}`
      );
    }

    sections[config.key] = data ?? [];
    includedLabels.push(config.labelSr);
  }

  const photos = await loadMealPhotoMetadata(supabase, userId);
  if (photos.missing) {
    missingSections.push(MEAL_PHOTOS_LABEL_SR);
  } else {
    sections.mealPhotos = photos.rows;
    includedLabels.push(MEAL_PHOTOS_LABEL_SR);
  }

  const klon = await loadKlon(supabase, userId);
  if (klon.missing) {
    missingSections.push(KLON_LABEL_SR);
  } else {
    // Absent (never drawn one) is not the same as unavailable: `null` is the
    // honest answer and belongs in the file, not in `missing_sections`.
    sections.klon = klon.row;
    includedLabels.push(KLON_LABEL_SR);
  }

  const missingNote =
    missingSections.length > 0
      ? ` Nedostupno u ovom izvozu: ${missingSections.join(", ")}.`
      : "";

  return {
    exported_at: new Date().toISOString(),
    schema_note:
      `Ovaj izvoz sadrži sledeće kategorije tvojih podataka: ${includedLabels.join(", ")}. ` +
      "Ne sadrži podatke drugih korisnika. Same slike obroka nisu uključene jer se " +
      "automatski brišu otprilike dan po unosu — podaci o obroku (kalorije i makroi) " +
      "ostaju u dnevnim unosima. Tvoj klon je uključen kao sam crtež; slike koje " +
      "si poslao da bi se nacrtao nisu, jer se nigde ne čuvaju." +
      missingNote,
    missing_sections: missingSections,
    account,
    profile,
    rules,
    ...sections,
  };
}
