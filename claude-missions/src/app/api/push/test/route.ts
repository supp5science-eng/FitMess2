import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { sendPush } from "@/lib/push/send";
import type { Database } from "@/lib/types/db";

// F071: sends a one-off test notification to the CALLER'S own devices, so
// the `/profil/podsetnici` screen can prove end-to-end delivery the moment
// reminders are enabled ("Pošalji probnu"). Session-bound client + own-row
// RLS — a user can only ever push to their own subscriptions.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const NO_SUBSCRIPTION_ERROR_SR =
  "Nema prijavljenog uređaja. Uključi podsetnike pa pokušaj ponovo.";
const SEND_FAILED_ERROR_SR =
  "Slanje nije uspelo. Proveri da li su notifikacije dozvoljene pa pokušaj ponovo.";

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: never needs to refresh the session cookie.
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

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push/test] subscriptions read failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: SEND_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json(
      { ok: false, error_sr: NO_SUBSCRIPTION_ERROR_SR },
      { status: 404 }
    );
  }

  let delivered = 0;
  for (const sub of subs) {
    const outcome = await sendPush(sub, {
      title: "Radi! 🎉",
      body: "Ovako će izgledati tvoj dnevni podsetnik.",
      url: "/profil/podsetnici",
    });
    if (outcome === "sent") delivered += 1;
    if (outcome === "gone") {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
    }
  }

  if (delivered === 0) {
    return NextResponse.json(
      { ok: false, error_sr: SEND_FAILED_ERROR_SR },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, delivered });
}
