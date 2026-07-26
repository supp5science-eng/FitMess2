import { createServerClient } from "@supabase/ssr";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { grantFullDayAward } from "@/lib/awards/grant";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { fillFoodMicrosIfMissing } from "@/lib/food/micro-fill";
import { createLogFromPortion } from "@/lib/food/portions";
import type { Database, LogMethod } from "@/lib/types/db";

// F025 / AS-041, AS-042: `POST /api/logs` -- creates a single log entry from
// an already-selected food + a resolved portion (grams). This is the shared
// log-CREATE endpoint the portion picker (`src/components/food/
// portion-picker.tsx`, shown after a food is picked on `/dodaj/pretraga`,
// F024) calls, and the intended reuse point for F031 (barcode scan) and
// F062/F064 (photo label/meal-estimate logging) -- they only need to POST
// here with their own `method` ('barcode'/'label') once they resolve a
// `foodId` + `grams`, never re-implement the macro-snapshot math themselves
// (see `src/lib/food/portions.ts`'s header comment).
//
// Same request-building shape as F023's `GET /api/foods/search` and F019's
// `POST /api/account/delete` (see those files' header comments for the full
// rationale): builds its Supabase client directly from `request.cookies`
// rather than `next/headers`'s `cookies()`, so this handler is directly
// callable in a Vitest process with a hand-built `NextRequest`. A no-op
// `setAll` is enough here -- like the search route, this call never signs
// the session in/out or otherwise needs to refresh/write the session cookie
// back.
//
// Uses the SESSION-scoped client end to end for BOTH the food lookup
// (`foods_select_all_authenticated` RLS) and the log insert
// (`logs_insert_own` RLS, see `supabase/migrations/0004_foods_logs.sql`) --
// RLS is what actually enforces "a user can only ever create their OWN log
// rows," not this route re-implementing that check. `grams` is the only
// portion input this route accepts; a common-unit selection (AS-042) is
// resolved to a gram amount by the calling UI BEFORE this request is sent
// (see `src/lib/food/portions.ts`'s `resolveUnitGrams`), so the server side
// only ever needs to know the ONE final number.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const FOOD_NOT_FOUND_ERROR_SR = "Namirnica nije pronađena.";
const LOG_CREATE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.";

const LOG_METHODS = ["search", "barcode", "label", "meal", "agent"] as const;

const bodySchema = z.object({
  foodId: z.string().min(1, MALFORMED_REQUEST_ERROR_SR),
  grams: z.number({ message: MALFORMED_REQUEST_ERROR_SR }),
  method: z.enum(LOG_METHODS).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh/write the session
          // cookie back -- see the header comment above.
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

  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { foodId, grams } = parsedBody.data;
  const method: LogMethod = parsedBody.data.method ?? "search";

  try {
    const { data: food, error: foodError } = await supabase
      .from("foods")
      // 0017: the micro columns come along so `createLogFromPortion` can
      // snapshot them onto the log exactly like the macros.
      .select(
        "id, name_sr, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, sodium_100g, sat_fat_100g"
      )
      .eq("id", foodId)
      .maybeSingle();

    if (foodError) {
      console.error("[F025 logs] food lookup failed:", foodError.message);
      return NextResponse.json(
        { ok: false, error_sr: LOG_CREATE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    if (!food) {
      return NextResponse.json(
        { ok: false, error_sr: FOOD_NOT_FOUND_ERROR_SR },
        { status: 404 }
      );
    }

    const result = await createLogFromPortion(supabase, {
      userId,
      food,
      grams,
      method,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error_sr: result.error_sr },
        { status: result.status }
      );
    }

    // 0017: a food nobody has micro values for yet (a freshly barcode-scanned
    // or hand-entered product) gets them estimated AFTER the response is sent,
    // so logging stays exactly as fast as before. Filling the catalog row is
    // enough for today's cards to become complete -- the home screen falls back
    // to the food's per-100g values when a log's own snapshot is null (see
    // `fillFoodMicrosIfMissing`).
    if (food.fiber_100g === null || food.fiber_100g === undefined) {
      after(() => fillFoodMicrosIfMissing(food.id));
    }

    // Nagrade (2026-07-26): this insert may have been the day's THIRD meal,
    // which earns the "pun dan" award and its celebration push. Also after the
    // response — logging a meal must never get slower because it might also be
    // a trophy — and `grantFullDayAward` swallows its own failures, so a missed
    // award can never turn a saved log into an error.
    after(() => grantFullDayAward(supabase, userId));

    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error("[F025 logs] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: LOG_CREATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
