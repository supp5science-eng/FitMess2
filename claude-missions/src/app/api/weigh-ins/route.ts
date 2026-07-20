import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

// F042 / AS-072, AS-073: `POST /api/weigh-ins` -- records the caller's weight
// for TODAY (the current Belgrade calendar day). This is what the "Upiši
// težinu" sheet on `/analitika` (`src/components/analytics/weigh-in-sheet.tsx`)
// posts to.
//
// Same request-building shape as `POST /api/logs` (see that file's header for
// the full rationale): the Supabase client is built directly from
// `request.cookies` with a no-op `setAll`, so this handler is directly
// callable in a Vitest process with a hand-built `NextRequest`, and it uses
// the SESSION-scoped client so `weigh_ins_insert_own` / `weigh_ins_update_own`
// RLS enforces "own rows only" -- never this route re-implementing that check.
//
// The DAY is assigned SERVER-side from `toBelgradeCalendarDay(new Date())` --
// the client never sends a day, so it cannot backfill or forge one. A same-day
// re-weigh REPLACES the earlier value (AS-073): the DB has a unique
// (user_id, day), and this route upserts on that conflict target rather than
// inserting a duplicate. Weight is bounded to a sane human range and rounded
// to one decimal (AS-072) before it is stored.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_WEIGHT_ERROR_SR = "Unesi težinu između 30 i 300 kg.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo težinu. Pokušaj ponovo.";

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

const bodySchema = z.object({
  weightKg: z
    .number({ message: INVALID_WEIGHT_ERROR_SR })
    .min(MIN_WEIGHT_KG, INVALID_WEIGHT_ERROR_SR)
    .max(MAX_WEIGHT_KG, INVALID_WEIGHT_ERROR_SR),
});

/** Rounds to one decimal (kg), avoiding binary-float noise. */
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh/write the session cookie
          // back -- see the header comment above.
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
      { ok: false, error_sr: INVALID_WEIGHT_ERROR_SR },
      { status: 400 }
    );
  }

  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_WEIGHT_ERROR_SR },
      { status: 400 }
    );
  }

  const weightKg = round1(parsedBody.data.weightKg);
  const day = toBelgradeCalendarDay(new Date());

  try {
    const { data, error } = await supabase
      .from("weigh_ins")
      .upsert(
        { user_id: userId, day, weight_kg: weightKg },
        { onConflict: "user_id,day" }
      )
      .select("id, day, weight_kg")
      .single();

    if (error || !data) {
      console.error(
        "[F042 weigh-ins] upsert failed:",
        error?.message ?? "no row returned"
      );
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("[F042 weigh-ins] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
