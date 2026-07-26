import type { SupabaseClient } from "@supabase/supabase-js";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import {
  configureWebPush,
  sendToAll,
  awardPayload,
  type StoredSubscription,
} from "@/lib/push/send";
import type { Database } from "@/lib/types/db";

import { currentStreak, FULL_DAY_AWARD, MEALS_FOR_FULL_DAY } from "./streak";

// Nagrade: granting the "pun dan" award when a day reaches three logged meals.
//
// Called from `POST /api/logs` inside `after()`, so it runs AFTER the response
// is already on its way — logging a meal must not get slower because it might
// also be a celebration. Nothing here is allowed to throw into that callback
// either: a failed award is a missed trophy, never a failed log.
//
// The grant is idempotent by the `awards` primary key `(user_id, day, kind)`,
// which is what lets this run on EVERY log insert instead of only when a
// counter happens to read exactly three. Delete the third meal and re-add it
// and no second push goes out — the row is already there.
//
// `supabase` is the caller's SESSION client: `awards_insert_own` and
// `push_subscriptions_select_own` RLS are what scope this to the acting user.

export type GrantOutcome =
  /** Fewer than three meals today — nothing to do. */
  | { granted: false; reason: "not-yet" }
  /** Three meals, but today was already awarded. */
  | { granted: false; reason: "already" }
  /** Something failed; the log itself was fine. */
  | { granted: false; reason: "error" }
  | { granted: true; streak: number; pushed: number };

/**
 * Grants today's award if it has been earned, and pushes the celebration.
 *
 * Never throws — the only caller is a fire-and-forget `after()`.
 */
export async function grantFullDayAward(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<GrantOutcome> {
  try {
    const todayKey = toBelgradeCalendarDay(now);

    // `head: true` + `count` asks Postgres for the number alone — the rows
    // themselves are never needed here.
    const { count, error: countError } = await supabase
      .from("logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("logged_at", startOfBelgradeDay(now).toISOString())
      .lt("logged_at", endOfBelgradeDayExclusive(now).toISOString());

    if (countError) {
      console.error("[nagrade] meal count failed:", countError.message);
      return { granted: false, reason: "error" };
    }

    if ((count ?? 0) < MEALS_FOR_FULL_DAY) {
      return { granted: false, reason: "not-yet" };
    }

    // `ignoreDuplicates` turns the race between two meals logged at the same
    // instant into a no-op instead of an error, and `.select()` then comes back
    // EMPTY when the row already existed — which is exactly the "was this the
    // first time?" signal the push needs.
    const { data: inserted, error: insertError } = await supabase
      .from("awards")
      .upsert(
        { user_id: userId, day: todayKey, kind: FULL_DAY_AWARD },
        { onConflict: "user_id,day,kind", ignoreDuplicates: true }
      )
      .select("day");

    if (insertError) {
      console.error("[nagrade] award insert failed:", insertError.message);
      return { granted: false, reason: "error" };
    }

    if (!inserted || inserted.length === 0) {
      return { granted: false, reason: "already" };
    }

    const streak = await readStreak(supabase, userId, todayKey);
    const pushed = await pushCelebration(supabase, userId, streak);

    return { granted: true, streak, pushed };
  } catch (error) {
    console.error("[nagrade] unexpected failure:", error);
    return { granted: false, reason: "error" };
  }
}

/**
 * The user's current run of full days.
 *
 * Bounded to the last ~120 days: a streak longer than that is already past
 * every milestone the reward screen has copy for, and an unbounded read would
 * grow forever for the app's most loyal users.
 */
export async function readStreak(
  supabase: SupabaseClient<Database>,
  userId: string,
  todayKey: string
): Promise<number> {
  const { data, error } = await supabase
    .from("awards")
    .select("day")
    .eq("user_id", userId)
    .eq("kind", FULL_DAY_AWARD)
    .order("day", { ascending: false })
    .limit(120);

  if (error) {
    console.error("[nagrade] streak read failed:", error.message);
    return 0;
  }

  return currentStreak(
    (data ?? []).map((row) => row.day),
    todayKey
  ).days;
}

/** Sends the celebration to every device the user has. Returns how many took
 * it; a user with reminders off entirely still gets this one only if they left
 * `award_enabled` on. */
async function pushCelebration(
  supabase: SupabaseClient<Database>,
  userId: string,
  streak: number
): Promise<number> {
  const { data: settings } = await supabase
    .from("reminder_settings")
    .select("award_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  // No row at all means the user never opened the reminders screen, so they
  // have never granted notification permission either — nothing to send to.
  if (!settings || !settings.award_enabled) return 0;

  if (!configureWebPush()) {
    console.error("[nagrade] VAPID env vars missing");
    return 0;
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subscriptions || subscriptions.length === 0) return 0;

  const results = await sendToAll(
    subscriptions as StoredSubscription[],
    awardPayload(streak)
  );

  const dead = results
    .filter((result) => result.status === "gone")
    .map((result) => result.id);

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return results.filter((result) => result.status === "sent").length;
}
