import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

// Koraci: `POST /api/koraci` — adds `deltaSteps` steps to the caller's running
// total for a Belgrade calendar `day`. This is what the "Koraci" card on
// `/danas` (`src/components/home/steps-card.tsx`) posts to.
//
// Same request-building + read-modify-write shape as `POST /api/voda`: the
// Supabase client is built directly from `request.cookies` with a no-op
// `setAll` (so it's testable with a hand-built `NextRequest`), it uses the
// SESSION-scoped client so `step_counts_*_own` RLS enforces "own rows only",
// and the client sends a DELTA (never an absolute total) so two quick adds
// compose instead of clobbering each other. The route clamps the resulting
// total to [0, MAX_STEPS] and upserts on (user_id, day). A forged future `day`
// is rejected (the strip never lets you view a future day).

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo korake. Pokušaj ponovo.";

const MAX_STEPS = 200000;

const bodySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_REQUEST_ERROR_SR),
  deltaSteps: z
    .number({ message: INVALID_REQUEST_ERROR_SR })
    .int(INVALID_REQUEST_ERROR_SR)
    .min(-MAX_STEPS, INVALID_REQUEST_ERROR_SR)
    .max(MAX_STEPS, INVALID_REQUEST_ERROR_SR),
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

  const { day, deltaSteps } = parsed.data;
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
      .from("step_counts")
      .select("steps")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();

    if (readError) {
      console.error("[koraci] read failed:", readError.message);
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    const nextSteps = Math.max(
      0,
      Math.min(MAX_STEPS, (existing?.steps ?? 0) + deltaSteps)
    );

    const { data, error } = await supabase
      .from("step_counts")
      .upsert(
        { user_id: userId, day, steps: nextSteps },
        { onConflict: "user_id,day" }
      )
      .select("day, steps")
      .single();

    if (error || !data) {
      console.error(
        "[koraci] upsert failed:",
        error?.message ?? "no row returned"
      );
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("[koraci] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
