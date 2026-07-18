import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  BARCODE_LOOKUP_FAILED_ERROR_SR,
  gtinSchema,
  lookupFoodByBarcode,
  MALFORMED_GTIN_ERROR_SR,
} from "@/lib/food/barcode";
import type { Database } from "@/lib/types/db";

// F031 / AS-053: `GET /api/foods/barcode/[gtin]` -- looks up a single food
// by the decoded GTIN the `/dodaj/skener` scan flow (F030's
// `BarcodeScanner`, wired through `src/components/scan/scan-screen.tsx`,
// this feature) emits.
//
// Mirrors `GET /api/foods/search`'s (F023) proven shape: builds its
// Supabase client directly from `request.cookies` rather than
// `next/headers`'s `cookies()`, so this handler is directly callable in a
// Vitest process with a hand-built `NextRequest` (no running Next server, no
// next/headers "outside request scope" error). A read-only `getAll` is
// enough (no `setAll`/cookie-write-back needed): this is a read-only GET,
// and the app-wide `src/middleware.ts` already refreshed the session cookie
// earlier in the same request.
//
// Uses the SESSION-scoped client end to end -- `foods` is a shared catalog
// (`foods_select_all_authenticated` RLS, see 0004_foods_logs.sql), so the
// only access-control gate this route enforces itself is "is there a
// signed-in user at all," same as the search route.
//
// A MISS (no `foods` row has this barcode) is `{ ok: true, data: null }`
// with a 200 -- NOT a 404 -- per the clarified "sensible empty response
// (null) with 200" answer. F032 (unknown barcode -> first-time entry) is
// the feature that turns a miss into a real UI flow; this route's job ends
// at "does a food with this barcode exist."

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gtin: string }> }
) {
  const { gtin: rawGtin } = await context.params;
  const parsedGtin = gtinSchema.safeParse(rawGtin);
  if (!parsedGtin.success) {
    return NextResponse.json(
      { ok: false, error_sr: MALFORMED_GTIN_ERROR_SR },
      { status: 400 }
    );
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this GET never needs to refresh/write the session
          // cookie back -- see the header comment above.
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  try {
    const { data, error } = await lookupFoodByBarcode(
      supabase,
      parsedGtin.data
    );
    if (error) {
      console.error("[F031 barcode] lookup failed:", error.message);
      return NextResponse.json(
        { ok: false, error_sr: BARCODE_LOOKUP_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    // Hit or miss -- both are a normal 200 (miss: data === null).
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("[F031 barcode] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: BARCODE_LOOKUP_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
