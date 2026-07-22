import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

// Voda: `POST /api/voda` — adds `deltaMl` millilitres of water to the caller's
// running total for a Belgrade calendar `day`. This is what the "Unesi vodu"
// sheet on `/danas` (`src/components/home/water-button.tsx`) posts to.
//
// Same request-building shape as `POST /api/weigh-ins`: the Supabase client is
// built directly from `request.cookies` with a no-op `setAll`, so this handler
// is directly callable in a Vitest process with a hand-built `NextRequest`, and
// it uses the SESSION-scoped client so `water_intake_*_own` RLS enforces "own
// rows only".
//
// The client sends a DELTA (e.g. +250 for a glass), never an absolute total,
// so two quick adds never clobber each other: this route reads the day's
// current total, adds the delta, clamps to [0, MAX_ML], and upserts on
// (user_id, day). The `day` is validated to be a real, non-future calendar day
// (the strip never lets you view a future day), so a client cannot backfill a
// forged future date.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo vodu. Pokušaj ponovo.";

const MAX_ML = 20000;

const bodySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_REQUEST_ERROR_SR),
  deltaMl: z
    .number({ message: INVALID_REQUEST_ERROR_SR })
    .int(INVALID_REQUEST_ERROR_SR)
    .min(-MAX_ML, INVALID_REQUEST_ERROR_SR)
    .max(MAX_ML, INVALID_REQUEST_ERROR_SR),
});

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh/write the session cookie.
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { day, deltaMl } = parsed.data;
  const todayKey = toBelgradeCalendarDay(new Date());
  if (day > todayKey) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  try {
    // Read-modify-write: the client only ever sends a delta, so concurrent
    // adds from the same user compose instead of overwriting a stale total.
    const { data: existing, error: readError } = await supabase
      .from("water_intake")
      .select("ml")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();

    if (readError) {
      console.error("[voda] read failed:", readError.message);
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    const nextMl = Math.max(0, Math.min(MAX_ML, (existing?.ml ?? 0) + deltaMl));

    const { data, error } = await supabase
      .from("water_intake")
      .upsert(
        { user_id: userId, day, ml: nextMl },
        { onConflict: "user_id,day" }
      )
      .select("day, ml")
      .single();

    if (error || !data) {
      console.error(
        "[voda] upsert failed:",
        error?.message ?? "no row returned"
      );
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("[voda] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
