import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { toBelgradeCalendarDay, getBelgradeDayRange } from "@/lib/dates";
import {
  buildReminderPayload,
  isReminderDue,
} from "@/lib/push/reminders";
import { sendPush } from "@/lib/push/send";

// F071 / AS-117: the daily-reminder sender. A Supabase pg_cron job POSTs
// here every 5 minutes (supabase/migrations/0017_push_reminders.sql — the
// same pg_net pattern the 0013 server-warmer uses); this route decides who
// is due via the pure `src/lib/push/reminders.ts` rules and sends through
// `web-push`.
//
// Access control: NOT publicly invocable. The route is excluded from the
// middleware matcher (no session machinery runs) and instead requires the
// `x-cron-secret` header to equal the CRON_SECRET env var. With the secret
// unset the route always refuses — misconfiguration fails closed.
//
// Idempotent by design (safe to re-run): `reminder_last_sent_on` is stamped
// per user the moment at least one of their devices accepts the push, so a
// second tick in the same window no-ops. Dead subscriptions (push service
// says 404/410) are pruned as they're discovered. Runs with the admin
// (service-role) client — a background job acting across users, per that
// client's documented purpose.

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);
  const supabase = createAdminClient();

  // Candidates: anyone with reminders enabled who hasn't been reminded today.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name, reminder_time, reminder_last_sent_on")
    .not("reminder_time", "is", null)
    .or(`reminder_last_sent_on.is.null,reminder_last_sent_on.neq.${todayKey}`);

  if (profilesError) {
    console.error("[cron/reminders] profiles read failed:", profilesError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const candidates = profiles ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, due: 0, sent: 0 });
  }

  // Zero-shame guard, one query for all candidates: who already logged a
  // meal today? They get no nag.
  const { startIso, endIsoExclusive } = getBelgradeDayRange(now);
  const candidateIds = candidates.map((p) => p.user_id);
  const { data: todaysLogs, error: logsError } = await supabase
    .from("logs")
    .select("user_id")
    .in("user_id", candidateIds)
    .gte("logged_at", startIso)
    .lt("logged_at", endIsoExclusive);

  if (logsError) {
    console.error("[cron/reminders] logs read failed:", logsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const loggedToday = new Set((todaysLogs ?? []).map((l) => l.user_id));

  const due = candidates.filter((p) =>
    isReminderDue(
      {
        reminderTime: p.reminder_time,
        lastSentOn: p.reminder_last_sent_on,
        hasLoggedToday: loggedToday.has(p.user_id),
      },
      now,
      todayKey
    )
  );

  if (due.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: candidates.length,
      due: 0,
      sent: 0,
    });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in(
      "user_id",
      due.map((p) => p.user_id)
    );

  if (subsError) {
    console.error("[cron/reminders] subscriptions read failed:", subsError.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const subsByUser = new Map<string, NonNullable<typeof subscriptions>>();
  for (const sub of subscriptions ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let sentUsers = 0;
  let prunedSubscriptions = 0;

  for (const profile of due) {
    const subs = subsByUser.get(profile.user_id) ?? [];
    if (subs.length === 0) continue;

    const payload = buildReminderPayload(profile.full_name);
    let delivered = false;

    for (const sub of subs) {
      const outcome = await sendPush(sub, payload);
      if (outcome === "sent") delivered = true;
      if (outcome === "gone") {
        prunedSubscriptions += 1;
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
    }

    // Stamp only on a real delivery: a fully-failed user is retried on the
    // next tick (still inside the catch-up window), never spammed twice in
    // one day once a device has accepted.
    if (delivered) {
      sentUsers += 1;
      await supabase
        .from("profiles")
        .update({ reminder_last_sent_on: todayKey })
        .eq("user_id", profile.user_id);
    }
  }

  const summary = {
    ok: true,
    checked: candidates.length,
    due: due.length,
    sent: sentUsers,
    pruned: prunedSubscriptions,
  };
  console.log("[cron/reminders]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
