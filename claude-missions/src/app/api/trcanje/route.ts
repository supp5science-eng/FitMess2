import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { computeRunSummary } from "@/lib/run/summary";
import type { Database } from "@/lib/types/db";

// Trčanje: `POST /api/trcanje` — saves a finished run. The recording screen
// (`src/components/run/run-recorder.tsx`) samples GPS and POSTs the raw trace
// here; the SERVER computes the authoritative totals (distance / duration /
// pace / calories via src/lib/run/**) so a forged body can't inflate them, and
// inserts one `runs` row (own-row RLS).
//
// Same request-building shape as `POST /api/koraci`: the Supabase client is
// built from `request.cookies` with a no-op `setAll` (testable with a hand-made
// NextRequest), SESSION-scoped so `runs_insert_own` enforces "own rows only".
// The Belgrade `day` is derived server-side from `startedAt`; a forged FUTURE
// day is rejected (you can only finish a run now or in the past).

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo trčanje. Pokušaj ponovo.";

/** A run can't reasonably carry more fixes than this (≈ >24h at 1 Hz). */
const MAX_POINTS = 100_000;

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().min(0),
});

const bodySchema = z.object({
  startedAt: z.string().datetime({ message: INVALID_REQUEST_ERROR_SR }),
  endedAt: z.string().datetime({ message: INVALID_REQUEST_ERROR_SR }),
  points: z.array(pointSchema).max(MAX_POINTS),
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

  const { startedAt, endedAt, points } = parsed.data;
  const day = toBelgradeCalendarDay(new Date(startedAt));

  // A run can only have finished by now — reject a forged future day.
  if (day > toBelgradeCalendarDay(new Date())) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // Current body weight for the calorie estimate: newest weigh-in wins, else
  // the profile's stored weight, else the lib's default.
  const [{ data: latestWeighIn }, { data: profile }] = await Promise.all([
    supabase
      .from("weigh_ins")
      .select("weight_kg")
      .eq("user_id", userId)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("weight_kg")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const weightKg = latestWeighIn?.weight_kg ?? profile?.weight_kg ?? null;

  const summary = computeRunSummary(points, weightKg);

  const { data: inserted, error } = await supabase
    .from("runs")
    .insert({
      user_id: userId,
      day,
      started_at: startedAt,
      ended_at: endedAt,
      duration_s: summary.durationS,
      distance_m: summary.distanceM,
      calories: summary.calories,
      route: points,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
