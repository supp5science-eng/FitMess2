import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import type { Database } from "@/lib/types/db";

// F071 / AS-116: registers (POST) and removes (DELETE) the caller's Web Push
// subscription. The body is exactly what `PushSubscription.toJSON()` yields
// on the client (`/profil/podsetnici`, reminders-screen.tsx).
//
// Same request-building shape as `POST /api/voda`: a session-scoped client
// built from `request.cookies` with a no-op `setAll`, so `push_subscriptions_*_own`
// RLS enforces "own rows only" — the route never filters on trust.
//
// Upsert on `endpoint` (globally unique per browser profile): re-enabling on
// the same device refreshes the keys in place, and a device handed to a
// different account moves cleanly to the new user.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo podsetnik. Pokušaj ponovo.";

const subscribeSchema = z.object({
  endpoint: z.string().url(INVALID_REQUEST_ERROR_SR).max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(INVALID_REQUEST_ERROR_SR).max(2048),
});

function sessionClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: these writes never need to refresh the session cookie.
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = sessionClient(request);
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = subscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { endpoint, keys } = parsed.data;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push/subscribe] upsert failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = sessionClient(request);
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = unsubscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // RLS scopes the delete to the caller's own rows regardless of endpoint.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("[push/subscribe] delete failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
