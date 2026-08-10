import { NextResponse, type NextRequest } from "next/server";

import {
  belgradeWeekdayIndex,
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import { computeDayTotals, computeRemaining } from "@/lib/home/totals";
import {
  remindersDue,
  type ReminderKind,
  type ReminderSettingsRow,
  type UserDayFacts,
} from "@/lib/push/due";
import { slotOf, type MealHistory, type MealSlot } from "@/lib/push/meal-rhythm";
import {
  configureWebPush,
  eveningPayload,
  mealPayload,
  sendToAll,
  weighInPayload,
  type PushPayload,
  toStoredSubscription,
  SUBSCRIPTION_COLUMNS,
  type StoredSubscription,
} from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_WEIGH_IN_DAY } from "@/lib/weight/weigh-in-day";

// Podsetnici: `POST /api/podsetnici/posalji` — the scheduled sender.
//
// Called every 15 minutes by a pg_cron job (see the note at the foot of
// `supabase/migrations/0021_push_reminders.sql`), the same Supabase-side
// mechanism that already keeps the server warm — so reminders cost nothing and
// need no Vercel Pro cron or external scheduler.
//
// This runs FOR users, not AS one, so it is the rare route that uses the
// service-role client (`createAdminClient`, RLS bypassed). Its only door is the
// shared secret in `x-fitmess-cron`; without a match it is a plain 401 and does
// no work. The secret is compared in constant time so the endpoint cannot be
// used as an oracle to guess it.
//
// v3 (2026-08-01) moved the interesting part into this handler's READS. The
// reminders are now conditional on how the day is actually going — which meal
// is missing off the user's own rhythm, whether a training day went unlogged,
// whether the recap has any news — so the handler gathers facts for every
// candidate user first (four batched queries for the whole run, never one per
// user) and hands them to the pure `remindersDue`, which also enforces the hard
// two-a-day ceiling.
//
// Each reminder carries its OWN once-a-day guard (`meal_last_sent` /
// `evening_last_sent` / `weighin_last_sent`) plus the shared `sent_count`
// budget, so re-running this in the same quarter-hour sends nothing.

const UNAUTHORIZED_SR = "Nije dozvoljeno.";
const NOT_CONFIGURED_SR = "Notifikacije nisu podešene na serveru.";

/** How far back the user's eating rhythm is measured. Two weeks is enough for a
 * stable median and short enough to follow someone whose schedule changed. */
const RHYTHM_DAYS = 14;

/** How recently someone must have logged training to be asked about it. */
const WORKOUT_HABIT_DAYS = 14;

/** Length-safe, timing-safe string compare (no `crypto.timingSafeEqual` here:
 * it throws on length mismatch, which would itself leak the length). */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Minutes since Belgrade midnight for `now`. */
function belgradeMinutesOfDay(now: Date): number {
  const midnight = startOfBelgradeDay(now);
  return Math.floor((now.getTime() - midnight.getTime()) / 60000);
}

/** The column each reminder stamps when it goes out. */
const LAST_SENT_COLUMN: Record<ReminderKind, string> = {
  meal: "meal_last_sent",
  evening: "evening_last_sent",
  weighin: "weighin_last_sent",
};

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-fitmess-cron") ?? "";

  if (!expected || !secretsMatch(expected, provided)) {
    return NextResponse.json(
      { ok: false, error_sr: UNAUTHORIZED_SR },
      { status: 401 }
    );
  }

  if (!configureWebPush()) {
    console.error("[podsetnici] VAPID env vars missing");
    return NextResponse.json(
      { ok: false, error_sr: NOT_CONFIGURED_SR },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);

  // Everyone with at least one reminder on. This table only ever holds users
  // who opened the settings page or answered the home-screen ask, so it stays
  // small; when it doesn't, the filter moves into the query.
  const { data: settings, error: settingsError } = await supabase
    .from("reminder_settings")
    .select(
      "user_id, meal_enabled, meal_last_sent, evening_enabled, evening_time, evening_last_sent, weighin_enabled, weighin_day, weighin_time, weighin_last_sent, sent_day, sent_count"
    )
    .or("meal_enabled.eq.true,evening_enabled.eq.true,weighin_enabled.eq.true");

  if (settingsError) {
    console.error("[podsetnici] settings read failed:", settingsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rows = (settings ?? []) as ReminderSettingsRow[];

  // Users who could still receive something today. Anyone already at the daily
  // ceiling is dropped BEFORE the fact-gathering queries — no point reading a
  // day we are not allowed to comment on.
  const candidateIds = rows
    .filter(
      (row) =>
        (row.sent_day === todayKey ? (row.sent_count ?? 0) : 0) < 2
    )
    .map((row) => row.user_id);

  // Whose weekly weigh-in reminder could go out in THIS run. On six days out
  // of seven this is empty and the read below never happens.
  const todayWeekday = belgradeWeekdayIndex(now);
  const weighInCandidateIds = rows
    .filter(
      (row) =>
        (row.weighin_enabled ?? false) &&
        (row.weighin_day ?? DEFAULT_WEIGH_IN_DAY) === todayWeekday &&
        (row.weighin_last_sent ?? null) !== todayKey
    )
    .map((row) => row.user_id);

  const [facts, lastWeighIn] = await Promise.all([
    candidateIds.length > 0
      ? readDayFacts(supabase, candidateIds, now)
      : new Map<string, UserDayFacts>(),
    weighInCandidateIds.length > 0
      ? readLastWeighIns(supabase, weighInCandidateIds, now)
      : new Map<string, string | null>(),
  ]);

  const due = remindersDue({
    settings: rows,
    facts,
    // Only meaningful for the users read above; everyone else is absent from
    // the map, which reads as "never weighed in" -- and their weigh-in
    // reminder was already ruled out by day/enabled/last-sent anyway.
    lastWeighIn,
    todayKey,
    nowMinutes: belgradeMinutesOfDay(now),
    // The weekly weigh-in reminder is the only one that cares which day it is.
    todayWeekdayIndex: todayWeekday,
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, data: { sent: 0, reminders: 0 } });
  }

  const userIds = [...new Set(due.map((item) => item.userId))];

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select(`user_id, ${SUBSCRIPTION_COLUMNS}`)
    .in("user_id", userIds);

  if (subsError) {
    console.error("[podsetnici] subscriptions read failed:", subsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const byUser = new Map<string, StoredSubscription[]>();
  for (const row of subscriptions ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(toStoredSubscription(row));
    byUser.set(row.user_id, list);
  }

  const deadSubscriptionIds: string[] = [];
  /** Per reminder kind, the users it actually reached. */
  const delivered: Record<ReminderKind, string[]> = {
    meal: [],
    evening: [],
    weighin: [],
  };
  /** How many pushes each user actually received in this run. */
  const spentByUser = new Map<string, number>();
  let sentCount = 0;

  for (const { userId, kind, mealReason } of due) {
    const devices = byUser.get(userId);
    // Reminder is on but every device is gone (uninstalled / revoked): nothing
    // to send, and nothing to mark — if they subscribe again tomorrow it just
    // works.
    if (!devices || devices.length === 0) continue;

    const userFacts = facts.get(userId);
    const payload: PushPayload =
      kind === "meal" && mealReason
        ? mealPayload(mealReason)
        : kind === "weighin"
          ? weighInPayload()
          : eveningPayload({
              loggedMeals: userFacts?.loggedMeals ?? 0,
              remainingKcal: userFacts?.remainingKcal ?? 0,
              overshootKcal: userFacts?.overshootKcal ?? 0,
              hasTarget: userFacts?.hasTarget ?? false,
              missingWorkout:
                (userFacts?.usesWorkouts ?? false) &&
                !(userFacts?.hasWorkoutToday ?? false),
            });

    const results = await sendToAll(devices, payload);
    for (const result of results) {
      if (result.status === "sent") sentCount += 1;
      if (result.status === "gone") deadSubscriptionIds.push(result.id);
      if (result.status === "failed") {
        console.error(
          "[podsetnici] send failed:",
          result.statusCode,
          result.message
        );
      }
    }

    // Mark the day as done when at least one device took it — a transient
    // failure on every device leaves the reminder eligible for the next run,
    // still inside the 2h late window, and does NOT spend the daily budget.
    if (results.some((result) => result.status === "sent")) {
      delivered[kind].push(userId);
      spentByUser.set(userId, (spentByUser.get(userId) ?? 0) + 1);
    }
  }

  if (deadSubscriptionIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadSubscriptionIds);
  }

  // One update per kind, not per user: the reminders stamp different columns,
  // so they cannot share a statement.
  for (const kind of ["meal", "evening", "weighin"] as const) {
    if (delivered[kind].length === 0) continue;
    await supabase
      .from("reminder_settings")
      .update({ [LAST_SENT_COLUMN[kind]]: todayKey })
      .in("user_id", delivered[kind]);
  }

  // The ceiling's bookkeeping. Per user because the number differs, and read
  // from the row we already have rather than re-read: a concurrent run of this
  // handler is prevented by the 15-minute cron, and the per-reminder
  // `*_last_sent` guards make a double-send impossible anyway.
  const rowById = new Map(rows.map((row) => [row.user_id, row]));
  await Promise.all(
    [...spentByUser.entries()].map(([userId, spentNow]) => {
      const row = rowById.get(userId);
      const before = row?.sent_day === todayKey ? (row.sent_count ?? 0) : 0;
      return supabase
        .from("reminder_settings")
        .update({ sent_day: todayKey, sent_count: before + spentNow })
        .eq("user_id", userId);
    })
  );

  return NextResponse.json({
    ok: true,
    data: {
      sent: sentCount,
      reminders:
        delivered.meal.length +
        delivered.evening.length +
        delivered.weighin.length,
      meal: delivered.meal.length,
      evening: delivered.evening.length,
      weighin: delivered.weighin.length,
      removed: deadSubscriptionIds.length,
    },
  });
}

/** How far back a weigh-in can still have settled the week being asked about.
 * The grace window is a day either side of the scheduled day, so a week is all
 * the history this question needs -- anything older cannot answer it. */
const WEIGH_IN_LOOKBACK_DAYS = 8;

/**
 * Each user's newest weigh-in day — one query for the whole run.
 *
 * A failed read yields an empty map, which reads as "nobody has weighed in"
 * and therefore sends every reminder. That is the safe direction: an
 * unnecessary nudge costs a tap, a silently skipped week costs the plan the
 * only real measurement it gets.
 */
async function readLastWeighIns(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: readonly string[],
  now: Date
): Promise<Map<string, string | null>> {
  const since = toBelgradeCalendarDay(
    new Date(startOfBelgradeDay(now).getTime() - WEIGH_IN_LOOKBACK_DAYS * 86_400_000)
  );

  const { data, error } = await supabase
    .from("weigh_ins")
    .select("user_id, day")
    .in("user_id", userIds as string[])
    .gte("day", since);

  if (error) {
    console.error("[podsetnici] weigh-ins read failed:", error.message);
    return new Map();
  }

  const newest = new Map<string, string | null>();
  for (const row of data ?? []) {
    const current = newest.get(row.user_id);
    // Plain string compare works: `"YYYY-MM-DD"` sorts chronologically.
    if (current == null || row.day > current) newest.set(row.user_id, row.day);
  }
  return newest;
}

/** A day we know nothing about — used when a fact read fails, so reminders
 * degrade to "say nothing" rather than to a wrong number. */
function emptyFacts(): UserDayFacts {
  return {
    todayLogMinutes: [],
    history: { byslot: { breakfast: [], lunch: [], dinner: [] } },
    hasWorkoutToday: false,
    usesWorkouts: false,
    loggedMeals: 0,
    hasTarget: false,
    remainingKcal: 0,
    overshootKcal: 0,
  };
}

/**
 * Everything the conditional reminders need to know, for every candidate user
 * — four batched queries for the whole run, never one per user.
 *
 * The kcal maths is the home screen's own (`computeDayTotals` /
 * `computeRemaining`), so the number in the notification is the same number the
 * ring shows when the user taps it.
 */
async function readDayFacts(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: readonly string[],
  now: Date
): Promise<Map<string, UserDayFacts>> {
  const ids = userIds as string[];
  const dayStart = startOfBelgradeDay(now);
  const dayEnd = endOfBelgradeDayExclusive(now);
  const rhythmStart = new Date(
    dayStart.getTime() - RHYTHM_DAYS * 86_400_000
  );
  const todayKey = toBelgradeCalendarDay(now);
  const workoutSince = toBelgradeCalendarDay(
    new Date(dayStart.getTime() - WORKOUT_HABIT_DAYS * 86_400_000)
  );

  const [
    { data: todayLogs, error: todayError },
    { data: pastLogs, error: pastError },
    { data: targets, error: targetsError },
    { data: workouts, error: workoutsError },
  ] = await Promise.all([
    supabase
      .from("logs")
      .select("user_id, kcal, protein, carbs, fat, logged_at")
      .in("user_id", ids)
      .gte("logged_at", dayStart.toISOString())
      .lt("logged_at", dayEnd.toISOString()),
    supabase
      .from("logs")
      .select("user_id, logged_at")
      .in("user_id", ids)
      .gte("logged_at", rhythmStart.toISOString())
      .lt("logged_at", dayStart.toISOString()),
    supabase
      .from("targets")
      .select("user_id, daily_kcal, effective_from")
      .in("user_id", ids)
      .order("effective_from", { ascending: false }),
    supabase
      .from("workouts")
      .select("user_id, day")
      .in("user_id", ids)
      .gte("day", workoutSince),
  ]);

  if (todayError)
    console.error("[podsetnici] today logs failed:", todayError.message);
  if (pastError)
    console.error("[podsetnici] rhythm logs failed:", pastError.message);
  if (targetsError)
    console.error("[podsetnici] targets failed:", targetsError.message);
  // Workouts are the youngest table here (0026): an environment without that
  // migration must lose the training question, not the whole run.
  if (workoutsError)
    console.error("[podsetnici] workouts failed:", workoutsError.message);

  // Rows come newest-first, so the FIRST one seen per user is the current
  // target — the same "latest effective_from wins" rule `/danas` applies.
  const targetByUser = new Map<string, number>();
  for (const row of targets ?? []) {
    if (!targetByUser.has(row.user_id)) {
      targetByUser.set(row.user_id, row.daily_kcal ?? 0);
    }
  }

  const facts = new Map<string, UserDayFacts>();
  for (const userId of ids) facts.set(userId, emptyFacts());

  const todayByUser = new Map<
    string,
    { kcal: number; protein: number; carbs: number; fat: number }[]
  >();
  const todayMinutes = new Map<string, number[]>();
  for (const row of todayLogs ?? []) {
    const list = todayByUser.get(row.user_id) ?? [];
    list.push({
      kcal: row.kcal ?? 0,
      protein: row.protein ?? 0,
      carbs: row.carbs ?? 0,
      fat: row.fat ?? 0,
    });
    todayByUser.set(row.user_id, list);

    const minutes = todayMinutes.get(row.user_id) ?? [];
    minutes.push(minutesOfBelgradeDay(new Date(row.logged_at)));
    todayMinutes.set(row.user_id, minutes);
  }

  // One entry per user per day per slot: the day's FIRST log in that slot is
  // the one that says when they eat. Later entries are second helpings and
  // would drag the median towards "whenever they were still typing".
  const firstBySlotDay = new Map<string, number>();
  for (const row of pastLogs ?? []) {
    const at = new Date(row.logged_at);
    const minutes = minutesOfBelgradeDay(at);
    const key = `${row.user_id}|${toBelgradeCalendarDay(at)}|${slotOf(minutes)}`;
    const existing = firstBySlotDay.get(key);
    if (existing == null || minutes < existing) firstBySlotDay.set(key, minutes);
  }

  const historyByUser = new Map<string, MealHistory>();
  for (const [key, minutes] of firstBySlotDay) {
    const [userId, , slot] = key.split("|") as [string, string, MealSlot];
    const history =
      historyByUser.get(userId) ??
      ({ byslot: { breakfast: [], lunch: [], dinner: [] } } as MealHistory);
    history.byslot[slot].push(minutes);
    historyByUser.set(userId, history);
  }

  const workoutDays = new Map<string, Set<string>>();
  for (const row of workouts ?? []) {
    const days = workoutDays.get(row.user_id) ?? new Set<string>();
    days.add(row.day);
    workoutDays.set(row.user_id, days);
  }

  for (const userId of ids) {
    const dayLogs = todayByUser.get(userId) ?? [];
    const target = targetByUser.get(userId) ?? 0;
    const totals = computeDayTotals(dayLogs);
    const remaining = computeRemaining(totals.kcal, target);
    const days = workoutDays.get(userId);

    facts.set(userId, {
      todayLogMinutes: todayMinutes.get(userId) ?? [],
      history:
        historyByUser.get(userId) ??
        ({ byslot: { breakfast: [], lunch: [], dinner: [] } } as MealHistory),
      hasWorkoutToday: days?.has(todayKey) ?? false,
      usesWorkouts: (days?.size ?? 0) > 0,
      loggedMeals: dayLogs.length,
      hasTarget: target > 0,
      remainingKcal: remaining.remainingKcal,
      overshootKcal: remaining.overshootKcal,
    });
  }

  return facts;
}

/** Minutes since Belgrade midnight for an instant. */
function minutesOfBelgradeDay(at: Date): number {
  const midnight = startOfBelgradeDay(at);
  return Math.floor((at.getTime() - midnight.getTime()) / 60000);
}
