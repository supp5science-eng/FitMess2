import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { searchFoods, searchQuerySchema } from "@/lib/food/search";
import type { Database } from "@/lib/types/db";

// F023 / AS-036, AS-037, AS-038: `GET /api/foods/search?q=...` -- the food
// search endpoint the "dodaj hranu -> pretraga" flow (F024+) calls to look
// up foods by name.
//
// Mirrors `GET /api/export`'s (F018) and `POST /api/account/delete`'s
// (F019) proven shape: builds its Supabase client directly from
// `request.cookies` rather than `next/headers`'s `cookies()`, so this
// handler is directly callable in a Vitest process with a hand-built
// `NextRequest` (no running Next server, no next/headers "outside request
// scope" error) -- see
// `src/app/api/export/__tests__/route.integration.test.ts` for the same
// pattern this feature's own integration test follows. A read-only `getAll`
// is enough (no `setAll`/cookie-write-back needed): this is a read-only
// GET, and the app-wide `src/middleware.ts` already refreshed the session
// cookie earlier in the same request.
//
// Uses the SESSION-scoped client (never `createAdminClient`) end to end --
// `public.search_foods()` is `security invoker`, so Postgres RLS
// (`foods_select_all_authenticated`, see 0004_foods_logs.sql) is what
// actually authorizes every row this endpoint can ever return, not
// application code. There is no per-food ownership check needed because
// `foods` is a SHARED catalog (every authenticated user may read every
// row) -- the only access-control gate this route enforces itself is "is
// there a signed-in user at all."

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const SEARCH_FAILED_ERROR_SR =
  "Pretraga trenutno ne radi. Pokušaj ponovo.";

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

  const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
  const parsedQuery = searchQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    const errorSr =
      parsedQuery.error.issues[0]?.message ?? "Neispravan zahtev.";
    return NextResponse.json({ ok: false, error_sr: errorSr }, { status: 400 });
  }

  try {
    const { data, error } = await searchFoods(supabase, parsedQuery.data);
    if (error) {
      console.error("[F023 search] search_foods RPC failed:", error.message);
      return NextResponse.json(
        { ok: false, error_sr: SEARCH_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
    // Empty state: no matches is still a 200 with an empty list, per the
    // clarified "Sensible empty response (empty list / null) with 200"
    // answer -- never a 404/error for "nothing found."
    return NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("[F023 search] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error_sr: SEARCH_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
