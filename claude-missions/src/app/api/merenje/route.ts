import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";
import { saveWeighIn } from "@/lib/weight/weigh-ins";

// Nedeljno merenje: `POST /api/merenje` — records one weigh-in.
//
// Same request-building shape as `POST /api/voda`: the Supabase client is built
// directly from `request.cookies` with a no-op `setAll`, so this handler is
// directly callable in a Vitest process with a hand-built `NextRequest`, and it
// uses the SESSION-scoped client so `weigh_ins_*_own` RLS enforces "own rows
// only".
//
// Deliberately dumb: it stores a number and says nothing about what it means.
// Reading the scale against the plan is `/merenje`'s server render (via
// `loadWeeklyReview`), so the verdict is computed in one place from stored
// data rather than being handed to the client by whichever request happened to
// write last.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const OUT_OF_RANGE_ERROR_SR = "Unesi težinu između 30 i 300 kg.";
const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo merenje. Pokušaj ponovo.";

// Mirrors the `weigh_ins` check constraint (0012) exactly, so a value the DB
// would reject is refused here with a sentence instead of a 500.
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

const bodySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_REQUEST_ERROR_SR),
  weightKg: z
    .number({ message: INVALID_REQUEST_ERROR_SR })
    .min(MIN_WEIGHT_KG, OUT_OF_RANGE_ERROR_SR)
    .max(MAX_WEIGHT_KG, OUT_OF_RANGE_ERROR_SR),
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
      {
        ok: false,
        error_sr:
          parsed.error.issues[0]?.message ?? INVALID_REQUEST_ERROR_SR,
      },
      { status: 400 }
    );
  }

  const { day, weightKg } = parsed.data;
  const todayKey = toBelgradeCalendarDay(new Date());
  // A weigh-in is a reading taken NOW. Backdating one would let a client
  // reshape the trend the plan is corrected against, so only today is accepted.
  if (day !== todayKey) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  // The column is numeric(4,1): one decimal, silently truncated by Postgres
  // otherwise. Round here so what we store is what the user is shown back.
  const rounded = Math.round(weightKg * 10) / 10;

  const { error } = await saveWeighIn(supabase, userId, day, rounded);

  if (error) {
    console.error("[merenje] save failed:", error.message);
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, data: { day, weightKg: rounded } },
    { status: 200 }
  );
}
