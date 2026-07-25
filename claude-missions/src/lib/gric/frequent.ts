import type { SupabaseClient } from "@supabase/supabase-js";

import { startOfBelgradeDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

// "Opet isto" — the shortcut that skips the microphone entirely. Most snacking
// is repetitive: the same apple, the same coffee, the same handful of almonds.
// If we can recognise the snack the user is about to log from their own
// history, the cheapest possible logging gesture is a single tap on a chip —
// no recording, no AI call, no confirm screen, works offline-ish and instantly.
//
// Deliberately built on the EXISTING `logs` rows (same approach as
// `src/lib/log/history.ts`) rather than a new "favourites" table: there is
// nothing for the user to curate, the list simply reflects what they actually
// eat, and it stays correct on its own.

/** How far back "what you usually snack on" looks. */
export const FREQUENT_WINDOW_DAYS = 30;

/** Above this, an entry was a meal, not a gric — it does not belong on the
 * quick-tap row (and re-logging a whole meal by accident is expensive). */
export const SNACK_KCAL_CEILING = 250;

/** Chips shown; enough to cover habits, few enough to scan in one glance. */
export const FREQUENT_LIMIT = 6;

/** A snack the user logs often, ready to be re-logged verbatim. */
export interface FrequentSnack {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Times logged in the window — drives the ordering. */
  count: number;
}

interface SnackRow {
  name: string;
  grams: number | string;
  kcal: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  logged_at: string;
}

/** `numeric` columns arrive as strings over PostgREST. */
const num = (value: number | string): number =>
  typeof value === "number" ? value : Number(value) || 0;

/** Case/whitespace-insensitive grouping key, so "Kajsije" and "kajsije " are
 * the same habit. The display name keeps the most recent spelling. */
const key = (name: string): string => name.trim().toLowerCase();

/**
 * Aggregates raw log rows into the most-logged snacks, newest spelling and
 * newest portion winning. Pure and exported for tests — the ranking is the
 * part with actual behaviour in it.
 *
 * Rows must arrive NEWEST FIRST (as `getFrequentSnacks` selects them), which
 * is what makes "first row seen for a name" the most recent one.
 */
export function rankFrequentSnacks(
  rows: SnackRow[],
  limit: number = FREQUENT_LIMIT
): FrequentSnack[] {
  const byName = new Map<string, FrequentSnack>();

  for (const row of rows) {
    const kcal = num(row.kcal);
    if (kcal > SNACK_KCAL_CEILING) continue;
    const name = row.name.trim();
    if (!name) continue;

    const existing = byName.get(key(name));
    if (existing) {
      existing.count += 1;
      continue;
    }
    // First sighting = most recent one: its portion is what we re-log.
    byName.set(key(name), {
      name,
      grams: num(row.grams),
      kcal,
      protein: num(row.protein),
      carbs: num(row.carbs),
      fat: num(row.fat),
      count: 1,
    });
  }

  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * The user's most-logged snacks over the trailing window. Session-bound RLS
 * client; `logs_select_own` enforces "own rows only".
 */
export async function getFrequentSnacks(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
  windowDays: number = FREQUENT_WINDOW_DAYS
): Promise<FrequentSnack[]> {
  const todayStart = startOfBelgradeDay(now);
  const windowStart = new Date(
    todayStart.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from("logs")
    .select("name, grams, kcal, protein, carbs, fat, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", windowStart.toISOString())
    .lte("kcal", SNACK_KCAL_CEILING)
    .order("logged_at", { ascending: false })
    .limit(300);

  // Best-effort: the quick-tap row is an accelerator, never a prerequisite.
  // If the read fails the user still has the microphone.
  if (error || !data) return [];

  return rankFrequentSnacks(data as SnackRow[]);
}
