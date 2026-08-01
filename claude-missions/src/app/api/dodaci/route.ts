import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getExtraFoods } from "@/lib/log/extras";
import type { Database } from "@/lib/types/db";

// "Nije bilo na slici" (2026-08-01): `GET /api/dodaci` -- the curated
// one-tap extras the "Dodaj još" sheet draws as chips (mayonnaise, bread, oil),
// resolved from the live `foods` catalog.
//
// Resolved server-side rather than hardcoded in the component so the numbers
// behind a chip are always the catalog's: an admin correcting mayonnaise in
// `/admin/hrana` corrects the chip too, and the client never ships a macro
// value it could disagree with the database about.
//
// Same request-building shape as `GET /api/foods/recents` -- client built
// straight from `request.cookies` so the handler is callable from Vitest with a
// hand-built `NextRequest`. Auth-gated because the catalog is only readable by
// signed-in users (`foods_select_all_authenticated`), which the session client
// enforces via RLS rather than this code re-checking it.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";

export async function GET(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: read-only GET, middleware already refreshed the session.
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

  try {
    // `getExtraFoods` is best-effort by contract: a catalog read that fails
    // yields an empty chip row, and the sheet's steppers keep working. There is
    // no user-facing error state here worth interrupting a snack for.
    const data = await getExtraFoods(supabase);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("[dodaci] unexpected failure:", err);
    return NextResponse.json({ ok: true, data: [] }, { status: 200 });
  }
}
