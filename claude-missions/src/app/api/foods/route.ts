import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { createFoodEntry, FOOD_CREATE_FAILED_ERROR_SR } from "@/lib/food/create";
import type { Database } from "@/lib/types/db";

// F032 / AS-055, AS-056, AS-057: `POST /api/foods` -- the crowd-sourcing
// create endpoint the first-time product entry form
// (`src/components/food/new-product-form.tsx`, shown at `/dodaj/novi-
// proizvod` after a barcode-lookup MISS, F031) calls to save a new product.
//
// Mirrors `POST /api/logs`'s (F025) proven shape: builds its Supabase
// client directly from `request.cookies` rather than `next/headers`'s
// `cookies()`, so this handler is directly callable in a Vitest process
// with a hand-built `NextRequest`. A no-op `setAll` is enough -- this write
// never signs the session in/out or otherwise needs to refresh/write the
// session cookie back.
//
// Uses the SESSION-scoped client end to end -- `foods_insert_authenticated`
// RLS (see `supabase/migrations/0004_foods_logs.sql`) is what actually
// enforces "a user may only attribute a submission to themselves," and
// `foods.barcode`'s UNIQUE constraint (AS-057) is what actually rejects a
// duplicate, not this route re-implementing either check.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";

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

  try {
    const result = await createFoodEntry(supabase, {
      submittedBy: userId,
      entry: rawBody,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error_sr: result.error_sr,
          existingFoodId: result.existingFoodId,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (err) {
    console.error("[F032 foods] unexpected failure creating food:", err);
    return NextResponse.json(
      { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
