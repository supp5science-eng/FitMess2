import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { collectUserExport, ExportReadError } from "@/lib/export/user-data";
import type { Database } from "@/lib/types/db";

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const EXPORT_FAILED_ERROR_SR =
  "Nije uspelo preuzimanje podataka. Pokušaj ponovo.";

/**
 * F018 / AS-014: GDPR self-serve data export -- "Preuzmi moje podatke" on
 * `/profil` links straight here; the browser's normal navigation + this
 * route's `Content-Disposition: attachment` header is what triggers the
 * download (no client-side JS needed).
 *
 * Builds its Supabase client directly from `request.cookies` (the same
 * pattern `src/lib/supabase/middleware.ts`'s `updateSession` uses) rather
 * than `next/headers`'s `cookies()` -- this Route Handler never needs to
 * WRITE a refreshed session cookie back (the app-wide `src/middleware.ts`
 * already refreshed it earlier in the same request, per its matcher), so a
 * read-only `getAll` is enough. This also makes the handler directly
 * callable in tests with a hand-built `NextRequest` carrying real session
 * cookies, the same way F013's `route-protection.integration.test.ts`
 * drives `middleware()` directly -- no running Next server required.
 *
 * Returns the export object itself as the response body on success (the
 * body IS the downloadable file's content), never wrapped in the usual
 * `{ok,data}` envelope; failures use the standard `{ok:false,error_sr}`
 * Serbian-error shape instead. Only ever reads the requesting user's own
 * data -- `collectUserExport` is given the session-bound client resolved
 * from THIS request's cookies, scoped to `auth.getUser()`'s own id, and
 * every query inside it is additionally filtered to that id (AS-013).
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this GET never needs to refresh/write the session cookie
          // back -- src/middleware.ts already did so earlier in the same
          // request, and a Route Handler's NextResponse here is a file
          // download, not a page navigation that needs a fresh Set-Cookie.
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
    const exportData = await collectUserExport(supabase, {
      id: user.id,
      email: user.email ?? null,
    });

    const filename = `fitmess-podaci-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof ExportReadError) {
      console.error("[F018 export] failed to read user data:", err.message);
    } else {
      console.error("[F018 export] unexpected export failure:", err);
    }
    return NextResponse.json(
      { ok: false, error_sr: EXPORT_FAILED_ERROR_SR },
      { status: 500 }
    );
  }
}
