import type { SupabaseClient } from "@supabase/supabase-js";

import type { DayAnswer } from "@/lib/home/day-trust";
import type { Database } from "@/lib/types/db";

/**
 * The user's own corrections to the plan's trust verdicts, read from the
 * database (migration 0029).
 *
 * These used to live only in the `fm_dani` cookie. That was fine while nothing
 * on screen asked; it stopped being fine on 2026-08-06, when the question came
 * back and people started investing thought in an answer that a new phone would
 * silently discard. See the migration's header for the full reasoning.
 *
 * ⚠️ Degrades to an EMPTY map on any read failure, including "this environment
 * hasn't applied 0029 yet". A missing answer costs the plan its correction --
 * it falls back to the heuristic, which is exactly what it did before this
 * table existed -- and never costs the dashboard its render. The caller merges
 * the cookie on top, so nothing is lost in the window before the migration
 * lands.
 */
export async function getDayAnswers(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Map<string, DayAnswer>> {
  const answers = new Map<string, DayAnswer>();

  try {
    const { data, error } = await supabase
      .from("day_answers")
      .select("day_key, answer")
      .eq("user_id", userId);

    if (error || !data) return answers;

    for (const row of data) {
      const dayKey = String(row.day_key);
      const answer = row.answer;
      if (answer === "complete" || answer === "partial") {
        answers.set(dayKey, answer);
      }
    }
  } catch {
    // A table this environment hasn't migrated yet costs the correction,
    // never the day.
  }

  return answers;
}

/**
 * Database answers with the cookie's answers merged UNDER them.
 *
 * Order matters and is deliberate: the row wins. The cookie is a local cache
 * plus a bridge for answers given before 0029 was applied, so it must never
 * overwrite a stored answer given later on another device.
 */
export function mergeDayAnswers(
  fromDatabase: Map<string, DayAnswer>,
  fromCookie: Map<string, DayAnswer>
): Map<string, DayAnswer> {
  const merged = new Map(fromCookie);
  for (const [dayKey, answer] of fromDatabase) merged.set(dayKey, answer);
  return merged;
}
