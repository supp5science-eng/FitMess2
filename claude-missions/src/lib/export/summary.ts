/**
 * The human-readable side of the data export: "how much of what do we
 * actually store about you".
 *
 * `collectUserExport` (user-data.ts) answers that in machine form -- this
 * answers it in the form someone can read before deciding whether they want
 * the file at all. Counts only, never contents: `count: "exact", head: true`
 * asks Postgres for the number and transfers no rows, so this stays cheap
 * even for a user with thousands of logs.
 *
 * Same RLS posture as the export itself: the caller's session-bound client,
 * every query additionally filtered to `userId`, never an admin client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

export interface ExportSummaryRow {
  key: string;
  labelSr: string;
  /** `null` = could not be read (e.g. the table isn't migrated onto this
   * environment yet). Rendered as "—", never as 0: "we have none of these"
   * and "we cannot tell" are different claims about someone's own data. */
  count: number | null;
}

export interface ExportSummary {
  email: string | null;
  /** `profiles.created_at` -- "with us since". */
  memberSince: string | null;
  rows: ExportSummaryRow[];
}

/** What gets counted, in the order the screen lists it. */
const COUNTED_TABLES: {
  key: string;
  table: "logs" | "weigh_ins" | "water_intake" | "step_counts" | "habit_checks" | "meal_photos" | "targets";
  labelSr: string;
}[] = [
  { key: "logs", table: "logs", labelSr: "Unosi hrane" },
  { key: "weighIns", table: "weigh_ins", labelSr: "Merenja težine" },
  { key: "waterIntake", table: "water_intake", labelSr: "Dani sa unetom vodom" },
  { key: "stepCounts", table: "step_counts", labelSr: "Dani sa koracima" },
  { key: "habitChecks", table: "habit_checks", labelSr: "Čekirane navike" },
  { key: "mealPhotos", table: "meal_photos", labelSr: "Slike obroka" },
  { key: "targets", table: "targets", labelSr: "Izmene plana" },
];

async function countRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  table: (typeof COUNTED_TABLES)[number]["table"]
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return null;
  return count ?? 0;
}

/**
 * Builds the summary shown on `/profil/moji-podaci`. Never throws: a section
 * that cannot be read becomes `null` rather than costing the user the whole
 * screen -- unlike the export file itself, where a silent gap would be a
 * false claim about their data.
 */
export async function collectExportSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null
): Promise<ExportSummary> {
  const [{ data: profile }, ...counts] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    ...COUNTED_TABLES.map((config) => countRows(supabase, userId, config.table)),
  ]);

  return {
    email,
    memberSince: profile?.created_at ?? null,
    rows: COUNTED_TABLES.map((config, index) => ({
      key: config.key,
      labelSr: config.labelSr,
      count: counts[index] as number | null,
    })),
  };
}

/** `"2026-07-17T…"` -> `"17. jul 2026."` (Serbian, as the app writes dates
 * elsewhere). Returns `null` for a missing/unparsable timestamp so the caller
 * can omit the row rather than print "Invalid Date". */
export function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(date);
}
