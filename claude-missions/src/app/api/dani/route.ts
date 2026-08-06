import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

// `POST /api/dani` — stores the user's answer to "Je li sreda stvarno bio dan
// od 420 kcal?" (`src/components/home/day-question.tsx`).
//
// Same request-building shape as `POST /api/voda`: the Supabase client is built
// straight from `request.cookies` with a no-op `setAll`, so the handler is
// callable in a Vitest process with a hand-built `NextRequest`, and it uses the
// SESSION-scoped client so `day_answers_*_own` RLS enforces "own rows only".
//
// Upsert on (user_id, day_key): re-answering the same day replaces the previous
// answer rather than piling up. The newest answer is the only one that means
// anything -- the `fm_dani` cookie this replaces was newest-wins too.
//
// ⚠️ A failure here is NOT fatal to the feature: `DayQuestion` also writes the
// cookie, so an environment that has not applied migration 0029 still behaves
// exactly as it did before. That is why the client does not surface an error.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo odgovor.";

const bodySchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_REQUEST_ERROR_SR),
  answer: z.enum(["complete", "partial"], {
    message: INVALID_REQUEST_ERROR_SR,
  }),
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

  const { dayKey, answer } = parsed.data;
  const todayKey = toBelgradeCalendarDay(new Date());
  // The question is only ever asked about a day that has already happened, so a
  // future key is a forged request, not a user.
  if (dayKey > todayKey) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("day_answers")
    .upsert(
      {
        user_id: userId,
        day_key: dayKey,
        answer,
        answered_on: todayKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day_key" }
    )
    .select("day_key, answer")
    .single();

  if (error || !data) {
    console.error(
      "[dani] upsert failed:",
      error?.message ?? "no row returned"
    );
    return NextResponse.json(
      { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}
