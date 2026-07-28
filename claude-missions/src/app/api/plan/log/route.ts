import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { HEALTHY_MEALS, scaleMeal } from "@/lib/plan/healthy-meals";
import type { Database } from "@/lib/types/db";

// "Šta da jedeš danas" (2026-07-28): `POST /api/plan/log` -- logs one suggested
// meal from /predlog as a single combined `logs` row (food_id null, method
// "meal"), the same shape the AI meal-estimate flows use for a whole-plate
// entry.
//
// The client sends only `{ templateId, targetKcal }` -- the server re-derives
// the meal's macros from the curated catalog with `scaleMeal`, so the diary can
// never be fed arbitrary numbers (the request only *chooses* a curated meal +
// its size, it does not *assert* the macros). Session-scoped client end to end;
// `logs_insert_own` RLS (0004_foods_logs.sql) is what enforces "own rows only".
//
// Same request-building shape as `POST /api/logs` (builds its Supabase client
// from `request.cookies` with a no-op `setAll`), so it is directly callable in
// a Vitest process with a hand-built `NextRequest`.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const MEAL_NOT_FOUND_ERROR_SR = "Predlog nije pronađen.";
const LOG_CREATE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.";

const bodySchema = z.object({
  templateId: z.string().min(1, MALFORMED_REQUEST_ERROR_SR),
  targetKcal: z
    .number({ message: MALFORMED_REQUEST_ERROR_SR })
    .positive(MALFORMED_REQUEST_ERROR_SR)
    .max(5000, MALFORMED_REQUEST_ERROR_SR),
});

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh the session cookie back.
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
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const template = HEALTHY_MEALS.find((m) => m.id === parsed.data.templateId);
  if (!template) {
    return NextResponse.json(
      { ok: false, error_sr: MEAL_NOT_FOUND_ERROR_SR },
      { status: 404 }
    );
  }

  // Re-derive the macros from the catalog -- the request only chose the meal.
  const meal = scaleMeal(template, parsed.data.targetKcal);
  const totalGrams = meal.items.reduce((sum, item) => sum + item.grams, 0);

  const { error: insertError } = await supabase.from("logs").insert({
    user_id: userId,
    food_id: null,
    name: meal.nameSr,
    grams: totalGrams,
    kcal: meal.macros.kcal,
    protein: meal.macros.proteinG,
    carbs: meal.macros.carbsG,
    fat: meal.macros.fatG,
    method: "meal",
    logged_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("[plan/log] insert failed:", insertError.message);
    return NextResponse.json(
      { ok: false, error_sr: LOG_CREATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
