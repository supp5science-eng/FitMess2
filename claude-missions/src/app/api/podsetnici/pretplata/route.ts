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
//
// Since 0030 the same route also takes a device from the store app, which has
// no Web Push triple to send — one APNs/FCM token instead. Same table, same
// row-per-device rule, different unique key. Two shapes rather than one loose
// one with everything optional: the database has a CHECK saying a row is one or
// the other, and a schema that could produce a half-web/half-native body would
// only discover that at write time, as a 500.

const NATIVE_PLATFORMS = ["ios", "android"] as const;

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

// APNs tokens are 64 hex characters and FCM's are ~160, but both vendors have
// changed that before and neither documents a ceiling — so the bound is only
// there to stop an unbounded write, not to validate the format.
const nativeSubscribeSchema = z.object({
  platform: z.enum(NATIVE_PLATFORMS),
  deviceToken: z.string().min(1, INVALID_REQUEST_ERROR_SR).max(4000),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(INVALID_REQUEST_ERROR_SR).max(2000),
});

const nativeUnsubscribeSchema = z.object({
  deviceToken: z.string().min(1, INVALID_REQUEST_ERROR_SR).max(4000),
});

/**
 * Which shape is this body claiming to be?
 *
 * Decided by the presence of `deviceToken` rather than by trying both schemas,
 * so a native body with one bad field is rejected as a broken native body
 * instead of falling through and being reported as a missing `endpoint` —
 * an error message that would send whoever debugs it in the wrong direction.
 */
function isNativeBody(json: unknown): boolean {
  return (
    typeof json === "object" &&
    json !== null &&
    "deviceToken" in (json as Record<string, unknown>)
  );
}

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

  if (isNativeBody(json)) {
    const parsed = nativeSubscribeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
        { status: 400 }
      );
    }

    const { platform, deviceToken, userAgent } = parsed.data;

    // The three Web Push columns are written as explicit nulls rather than
    // left out: a phone can be reinstalled onto a row that is already there,
    // and `push_subscriptions_platform_shape` rejects any row that carries
    // both a token and an endpoint.
    const { error: nativeError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          platform,
          device_token: deviceToken,
          endpoint: null,
          p256dh: null,
          auth: null,
          user_agent: userAgent ?? null,
        },
        { onConflict: "device_token" }
      );

    if (nativeError) {
      console.error("[podsetnici] native subscribe failed:", nativeError.message);
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
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
      platform: "web",
      endpoint,
      p256dh,
      auth,
      device_token: null,
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

  // RLS keeps this to the caller's own rows; the explicit user_id filter is
  // belt-and-braces, not the security boundary.
  const rows = supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  let deletion;
  if (isNativeBody(json)) {
    const parsed = nativeUnsubscribeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
        { status: 400 }
      );
    }
    deletion = rows.eq("device_token", parsed.data.deviceToken);
  } else {
    const parsed = unsubscribeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
        { status: 400 }
      );
    }
    deletion = rows.eq("endpoint", parsed.data.endpoint);
  }

  const { error } = await deletion;

  if (error) {
    console.error("[podsetnici] unsubscribe failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: DELETE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
