import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { deleteAccount } from "@/lib/account/delete-account";
import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/db";

/**
 * F019 / AS-015 (self-serve delete removes personal data), AS-016 (deleted
 * credentials stop authenticating).
 *
 * `POST /api/account/delete` -- the destructive action the type-to-confirm
 * dialog on `/profil` (`src/components/profil/delete-account-dialog.tsx`)
 * submits to. Mirrors `/api/export`'s (F018) proven shape for the SAME
 * reasons: builds its Supabase client directly from `request.cookies`
 * rather than `next/headers`'s `cookies()`, so this handler is directly
 * callable in a Vitest process with a hand-built `NextRequest` (no running
 * Next server, no next/headers "outside request scope" error) -- but this
 * route ALSO needs to WRITE a cleared session cookie back on success (the
 * export route never needed to write), so it captures `setAll`'s calls into
 * `cookiesToForward` and re-applies them onto the `NextResponse` it builds,
 * the same two-phase pattern `src/lib/supabase/middleware.ts`'s
 * `updateSession` uses for a real cookie-writing response.
 *
 * Only ever resolves/deletes the CALLER's own account: `user.id` comes
 * exclusively from this request's own session (`auth.getUser()`), never
 * from the request body or any other input -- there is no `userId`
 * parameter this route accepts at all, so there is no cross-user deletion
 * vector to defend against (AS-015's "own account only" guarantee).
 */

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const MALFORMED_REQUEST_ERROR_SR = "Neispravan zahtev.";
const CONFIRMATION_MISMATCH_ERROR_SR = `Za brisanje naloga upiši tačno "${DELETE_CONFIRMATION_PHRASE}".`;

const bodySchema = z.object({
  confirm: z.string(),
});

export async function POST(request: NextRequest) {
  let cookiesToForward: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToForward = cookiesToSet;
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

  if (parsedBody.data.confirm !== DELETE_CONFIRMATION_PHRASE) {
    // Server-side re-validation of the type-to-confirm text -- defense in
    // depth alongside the client-side gate in the dialog component. Nothing
    // has been touched yet at this point (no admin call made), so this is
    // itself a "no partial write" failure path: the account is untouched.
    return NextResponse.json(
      { ok: false, error_sr: CONFIRMATION_MISMATCH_ERROR_SR },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const result = await deleteAccount(admin, user.id);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error_sr: result.error_sr }, { status: 500 });
  }

  // The auth user is already gone; this clears the browser's now-stale
  // session cookie(s) too. `signOut()` itself may error server-side (there
  // is no live session left to revoke against a deleted user) -- that is
  // not a failure of the deletion itself, which already succeeded, so it is
  // swallowed rather than surfaced as an error to the caller.
  await supabase.auth.signOut().catch(() => {});

  const response = NextResponse.json({ ok: true, data: null }, { status: 200 });
  for (const { name, value, options } of cookiesToForward) {
    response.cookies.set(name, value, options);
  }
  return response;
}
