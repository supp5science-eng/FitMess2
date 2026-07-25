import { NextResponse, type NextRequest } from "next/server";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import { usersDueForNoLogReminder } from "@/lib/push/due";
import {
  configureWebPush,
  noLogReminderPayload,
  sendToAll,
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
// Who gets a push is decided by the pure `usersDueForNoLogReminder`
// (`src/lib/push/due.ts`) — this handler only gathers rows and applies the
// result. Re-running it in the same quarter-hour sends nothing, because the
// once-a-day guard (`no_log_last_sent`) is written the moment a user is
// reminded.

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

  // Everyone who has the reminder on. This table only ever holds users who
  // opened the settings page, so it stays small; when it doesn't, the filter
  // moves into the query.
  const { data: settings, error: settingsError } = await supabase
    .from("reminder_settings")
    .select("user_id, no_log_enabled, no_log_time, no_log_last_sent")
    .eq("no_log_enabled", true);

  if (settingsError) {
    console.error("[podsetnici] settings read failed:", settingsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const candidates = settings ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, data: { sent: 0, users: 0 } });
  }

  // Who already logged something today? One query for the whole batch, bounded
  // to today's Belgrade window — the same day boundaries `/danas` uses.
  const { data: todayLogs, error: logsError } = await supabase
    .from("logs")
    .select("user_id")
    .in(
      "user_id",
      candidates.map((row) => row.user_id)
    )
    .gte("logged_at", startOfBelgradeDay(now).toISOString())
    .lt("logged_at", endOfBelgradeDayExclusive(now).toISOString());

  if (logsError) {
    console.error("[podsetnici] logs read failed:", logsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const dueUserIds = usersDueForNoLogReminder({
    settings: candidates,
    usersWithLogsToday: new Set((todayLogs ?? []).map((row) => row.user_id)),
    todayKey,
    nowMinutes: belgradeMinutesOfDay(now),
  });

  if (dueUserIds.length === 0) {
    return NextResponse.json({ ok: true, data: { sent: 0, users: 0 } });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", dueUserIds);

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

  const payload = noLogReminderPayload();
  const deadSubscriptionIds: string[] = [];
  const remindedUserIds: string[] = [];
  let sentCount = 0;

  for (const userId of dueUserIds) {
    const devices = byUser.get(userId);
    // Reminder is on but every device is gone (uninstalled / revoked): nothing
    // to send, and nothing to mark — if they subscribe again tomorrow it just
    // works.
    if (!devices || devices.length === 0) continue;

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
    // failure on every device leaves the user eligible for the next run, still
    // inside the 2h late window.
    if (results.some((result) => result.status === "sent")) {
      remindedUserIds.push(userId);
    }
  }

  if (deadSubscriptionIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadSubscriptionIds);
  }

  if (remindedUserIds.length > 0) {
    await supabase
      .from("reminder_settings")
      .update({ no_log_last_sent: todayKey })
      .in("user_id", remindedUserIds);
  }

  return NextResponse.json({
    ok: true,
    data: {
      sent: sentCount,
      users: remindedUserIds.length,
      removed: deadSubscriptionIds.length,
    },
  });
}
