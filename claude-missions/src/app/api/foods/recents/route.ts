import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getRecentFoods } from "@/lib/food/recents";
import type { Database } from "@/lib/types/db";

// F024 / AS-040: `GET /api/foods/recents` -- the signed-in user's own
// distinct, most-recently-logged foods (never another user's), used both to
// re-rank recent foods above generic matches in the `/dodaj/pretraga`
// search UI and to power its "Nedavno korišćeno" quick-add list when the
// search box is empty.
//
// Same shape as F023's `GET /api/foods/search` (see
// `src/app/api/foods/search/route.ts`'s header comment for the full
// rationale): builds its Supabase client directly from `request.cookies`
// rather than `next/headers`'s `cookies()`, so this handler is directly
// callable in a Vitest process with a hand-built `NextRequest` (no running
// Next server). A read-only `getAll` is enough -- this is a read-only GET,
// and `src/middleware.ts` already refreshed the session cookie earlier in
// the same request.
//
// Uses the SESSION-scoped client end to end -- `logs_select_own` RLS (see
// `supabase/migrations/0004_foods_logs.sql`) is what actually guarantees
// this route can only ever return the CALLER's own logged foods, not
// application code re-implementing that check.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const RECENTS_FAILED_ERROR_SR =
  "Nismo uspeli da učitamo nedavno korišćene namirnice. Pokušaj ponovo.";

export async function GET(request: NextRequest) {
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
    const { data, error } = await getRecentFoods(supabase, user.id);
    if (error) {
      console.error("[F024 recents] getRecentFoods failed:", error.message);
      return NextResponse.json(
        { ok: false, error_sr: RECENTS_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    // Empty state: no logged foods yet is still a 200 with an empty list
    // (per the same "sensible empty response with 200" convention F023's
    // search route follows), never a 404/error.
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("[F024 recents] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: RECENTS_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
