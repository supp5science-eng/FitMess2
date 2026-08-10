import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  configureWebPush,
  sendToAll,
  testPayload,
  toStoredSubscription,
  SUBSCRIPTION_COLUMNS,
} from "@/lib/push/send";
import type { Database } from "@/lib/types/db";

// Podsetnici: `POST /api/podsetnici/proba` — sends the caller a test push, now.
//
// This exists because a reminder feature is otherwise untestable without
// waiting for a scheduled time: the user turns it on, nothing visibly happens,
// and they have no way to tell "it works, be patient" from "it is broken". The
// button in Podešavanja fires this and goes through the SAME `sendToAll` the
// cron uses, so a successful test proves the whole chain (VAPID keys ->
// subscription row -> push service -> service worker).
//
// A subscription the push service reports as gone (404/410) is deleted right
// here, which doubles as self-healing: the stale row from a reinstall
// disappears the first time the user taps "pošalji probnu".

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const NOT_CONFIGURED_ERROR_SR =
  "Notifikacije nisu podešene na serveru. Javi nam se.";
const NO_SUBSCRIPTION_ERROR_SR =
  "Ovaj uređaj nije prijavljen za podsetnike. Uključi ih pa probaj ponovo.";
const SEND_FAILED_ERROR_SR =
  "Nismo uspeli da pošaljemo probnu notifikaciju. Pokušaj ponovo.";

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  if (!configureWebPush()) {
    console.error("[podsetnici] VAPID env vars missing");
    return NextResponse.json(
      { ok: false, error_sr: NOT_CONFIGURED_ERROR_SR },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId);

  if (error) {
    console.error("[podsetnici] test read failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: SEND_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  const subscriptions = (data ?? []).map(toStoredSubscription);
  if (subscriptions.length === 0) {
    return NextResponse.json(
      { ok: false, error_sr: NO_SUBSCRIPTION_ERROR_SR },
      { status: 400 }
    );
  }

  const results = await sendToAll(subscriptions, testPayload());

  const gone = results.filter((r) => r.status === "gone").map((r) => r.id);
  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", gone);
  }

  const sent = results.filter((r) => r.status === "sent").length;
  if (sent === 0) {
    const failed = results.find((r) => r.status === "failed");
    if (failed && failed.status === "failed") {
      console.error(
        "[podsetnici] test send failed:",
        failed.statusCode,
        failed.message
      );
    }
    return NextResponse.json(
      { ok: false, error_sr: NO_SUBSCRIPTION_ERROR_SR },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, data: { sent } });
}
