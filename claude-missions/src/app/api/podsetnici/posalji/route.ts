import { NextResponse, type NextRequest } from "next/server";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import { computeDayTotals, computeRemaining } from "@/lib/home/totals";
import {
  remindersDue,
  type ReminderKind,
  type ReminderSettingsRow,
} from "@/lib/push/due";
import {
  configureWebPush,
  eveningPayload,
  morningPayload,
  sendToAll,
  type PushPayload,
  type StoredSubscription,
} from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/server";

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
// v2 (2026-07-26) sends TWO daily reminders. Which ones are due is decided by
// the pure `remindersDue` (`src/lib/push/due.ts`); this handler gathers rows,
// applies the result, and — for the evening recap only — does the extra work of
// finding out how the user's day actually went, because that reminder reports a
// number rather than just nudging.
//
// Each reminder carries its OWN once-a-day guard (`morning_last_sent` /
// `evening_last_sent`), written the moment it goes out, so re-running this in
// the same quarter-hour sends nothing.

const UNAUTHORIZED_SR = "Nije dozvoljeno.";
const NOT_CONFIGURED_SR = "Notifikacije nisu podešene na serveru.";

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
  morning: "morning_last_sent",
  evening: "evening_last_sent",
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
  // who opened the settings page, so it stays small; when it doesn't, the
  // filter moves into the query.
  const { data: settings, error: settingsError } = await supabase
    .from("reminder_settings")
    .select(
      "user_id, morning_enabled, morning_time, morning_last_sent, evening_enabled, evening_time, evening_last_sent"
    )
    .or("morning_enabled.eq.true,evening_enabled.eq.true");

  if (settingsError) {
    console.error("[podsetnici] settings read failed:", settingsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const due = remindersDue({
    settings: (settings ?? []) as ReminderSettingsRow[],
    todayKey,
    nowMinutes: belgradeMinutesOfDay(now),
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, data: { sent: 0, reminders: 0 } });
  }

  const userIds = [...new Set(due.map((item) => item.userId))];

  // The evening recap is the only reminder that needs to know anything about
  // the day, so the two reads below are skipped entirely on a run that is all
  // morning nudges.
  const eveningUserIds = due
    .filter((item) => item.kind === "evening")
    .map((item) => item.userId);
  const recaps =
    eveningUserIds.length > 0
      ? await readRecaps(supabase, eveningUserIds, now)
      : new Map<string, ReturnType<typeof emptyRecap>>();

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsError) {
    console.error("[podsetnici] subscriptions read failed:", subsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const byUser = new Map<string, StoredSubscription[]>();
  for (const row of subscriptions ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    });
    byUser.set(row.user_id, list);
  }

  const deadSubscriptionIds: string[] = [];
  /** Per reminder kind, the users it actually reached. */
  const delivered: Record<ReminderKind, string[]> = { morning: [], evening: [] };
  let sentCount = 0;

  for (const { userId, kind } of due) {
    const devices = byUser.get(userId);
    // Reminder is on but every device is gone (uninstalled / revoked): nothing
    // to send, and nothing to mark — if they subscribe again tomorrow it just
    // works.
    if (!devices || devices.length === 0) continue;

    const payload: PushPayload =
      kind === "morning"
        ? morningPayload()
        : eveningPayload(recaps.get(userId) ?? emptyRecap());

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
    // still inside the 2h late window.
    if (results.some((result) => result.status === "sent")) {
      delivered[kind].push(userId);
    }
  }

  if (deadSubscriptionIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadSubscriptionIds);
  }

  // One update per kind, not per user: the two reminders stamp different
  // columns, so they cannot share a statement.
  for (const kind of ["morning", "evening"] as const) {
    if (delivered[kind].length === 0) continue;
    await supabase
      .from("reminder_settings")
      .update({ [LAST_SENT_COLUMN[kind]]: todayKey })
      .in("user_id", delivered[kind]);
  }

  return NextResponse.json({
    ok: true,
    data: {
      sent: sentCount,
      reminders: delivered.morning.length + delivered.evening.length,
      morning: delivered.morning.length,
      evening: delivered.evening.length,
      removed: deadSubscriptionIds.length,
    },
  });
}

/** A day we know nothing about — used when the recap read fails, so the evening
 * reminder degrades to its "dan ti je prazan" copy instead of not going out. */
function emptyRecap() {
  return { loggedMeals: 0, remainingKcal: 0, overshootKcal: 0, hasTarget: false };
}

/**
 * Today's meal count and remaining kcal for each user getting an evening
 * recap — two batched queries for the whole run, never one per user.
 *
 * The kcal maths is the home screen's own (`computeDayTotals` /
 * `computeRemaining`), so the number in the notification is the same number the
 * ring shows when the user taps it.
 */
async function readRecaps(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: readonly string[],
  now: Date
): Promise<Map<string, ReturnType<typeof emptyRecap>>> {
  const recaps = new Map<string, ReturnType<typeof emptyRecap>>();

  const [{ data: logs, error: logsError }, { data: targets, error: targetsError }] =
    await Promise.all([
      supabase
        .from("logs")
        .select("user_id, kcal, protein, carbs, fat")
        .in("user_id", userIds as string[])
        .gte("logged_at", startOfBelgradeDay(now).toISOString())
        .lt("logged_at", endOfBelgradeDayExclusive(now).toISOString()),
      supabase
        .from("targets")
        .select("user_id, daily_kcal, effective_from")
        .in("user_id", userIds as string[])
        .order("effective_from", { ascending: false }),
    ]);

  if (logsError) console.error("[podsetnici] recap logs failed:", logsError.message);
  if (targetsError)
    console.error("[podsetnici] recap targets failed:", targetsError.message);

  // Rows come newest-first, so the FIRST one seen per user is the current
  // target — the same "latest effective_from wins" rule `/danas` applies.
  const targetByUser = new Map<string, number>();
  for (const row of targets ?? []) {
    if (!targetByUser.has(row.user_id)) {
      targetByUser.set(row.user_id, row.daily_kcal ?? 0);
    }
  }

  const logsByUser = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }[]>();
  for (const row of logs ?? []) {
    const list = logsByUser.get(row.user_id) ?? [];
    list.push({
      kcal: row.kcal ?? 0,
      protein: row.protein ?? 0,
      carbs: row.carbs ?? 0,
      fat: row.fat ?? 0,
    });
    logsByUser.set(row.user_id, list);
  }

  for (const userId of userIds) {
    const dayLogs = logsByUser.get(userId) ?? [];
    const target = targetByUser.get(userId) ?? 0;
    const totals = computeDayTotals(dayLogs);
    const remaining = computeRemaining(totals.kcal, target);

    recaps.set(userId, {
      loggedMeals: dayLogs.length,
      remainingKcal: remaining.remainingKcal,
      overshootKcal: remaining.overshootKcal,
      hasTarget: target > 0,
    });
  }

  return recaps;
}
