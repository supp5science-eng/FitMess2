import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/db";

export type SessionRefreshResult = {
  /** The response carrying the refreshed session cookie(s). The caller
   * (`src/middleware.ts`) must return this unmodified on every "allow" path
   * -- replacing it with a fresh `NextResponse.next()` would drop the
   * refreshed cookies and can cause random sign-outs. */
  response: NextResponse;
  /** The signed-in user for this request, re-validated against Supabase
   * Auth's servers by `auth.getUser()` (never a locally-decoded JWT), or
   * `null` if there is no valid session. */
  user: User | null;
  /** The same cookie-bound client used for the refresh, typed to the
   * project's schema so callers (F013's route-protection middleware) can
   * run further own-row-RLS-scoped reads -- e.g. the onboarding-status
   * check -- without constructing a second client from the same request. */
  supabase: SupabaseClient<Database>;
};

/**
 * Refreshes the Supabase auth session cookie for a request and returns the
 * response that should be sent back, plus the resolved user and the
 * cookie-bound client used to resolve it.
 *
 * This is a session-refresh helper -- it does not itself decide which
 * routes require authentication or perform any redirect. F013's root
 * `src/middleware.ts` is what implements the actual redirect matrix, using
 * this helper for the session-refresh + user-lookup plumbing, e.g.:
 *
 *   import { updateSession } from "@/lib/supabase/middleware";
 *   import type { NextRequest } from "next/server";
 *
 *   export async function middleware(request: NextRequest) {
 *     const { response, user, supabase } = await updateSession(request);
 *     // ...decide allow/redirect using `user` (and `supabase` for
 *     // further own-row reads), then return either `response` or a
 *     // `NextResponse.redirect(...)`.
 *   }
 *
 *   export const config = {
 *     matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
 *   };
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionRefreshResult> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between `createServerClient` and `auth.getUser()`.
  // Both are required to keep the session cookie fresh; skipping the call
  // can cause users to be randomly signed out (per Supabase SSR docs).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user, supabase };
}
