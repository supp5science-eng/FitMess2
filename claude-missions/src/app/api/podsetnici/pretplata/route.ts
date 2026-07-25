import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import type { Database } from "@/lib/types/db";

// Podsetnici: `POST /api/podsetnici/pretplata` stores this device's Web Push
// subscription, `DELETE` removes it.
//
// Same request-building shape as `/api/voda`: the Supabase client is built from
// `request.cookies` with a no-op `setAll`, so the handler is directly callable
// from a Vitest process, and every write goes through the SESSION-scoped client
// — `push_subscriptions_*_own` RLS is what enforces "own rows only".
//
// The endpoint is the unique key: re-subscribing the same device (which the
// browser does on its own schedule, e.g. after a key rotation) must UPDATE the
// existing row, never pile up duplicates that would each deliver the same
// notification.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da uključimo podsetnike. Pokušaj ponovo.";
const DELETE_FAILED_ERROR_SR =
  "Nismo uspeli da isključimo podsetnike. Pokušaj ponovo.";

const subscribeSchema = z.object({
  endpoint: z.string().url(INVALID_REQUEST_ERROR_SR).max(2000),
  p256dh: z.string().min(1, INVALID_REQUEST_ERROR_SR).max(500),
  auth: z.string().min(1, INVALID_REQUEST_ERROR_SR).max(500),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(INVALID_REQUEST_ERROR_SR).max(2000),
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { endpoint, p256dh, auth, userAgent } = parsed.data;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[podsetnici] subscribe failed:", error.message);
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = unsubscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // RLS keeps this to the caller's own rows; the explicit user_id filter is
  // belt-and-braces, not the security boundary.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("[podsetnici] unsubscribe failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: DELETE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
