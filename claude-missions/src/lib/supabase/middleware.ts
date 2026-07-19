import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/db";

/**
 * The minimal, trustworthy slice of the access-token JWT the middleware needs.
 * Resolved by `auth.getClaims()`, which cryptographically verifies the token's
 * signature against the project's cached public key -- so these values are as
 * trustworthy as `auth.getUser()`'s, but without its per-request network call.
 */
export type SessionClaims = {
  /** The signed-in user's id (`sub`). */
  sub: string;
  /** The user's email, when present in the token (used only to prefill the
   * resend-confirmation form). */
  email: string | null;
  /** The auth provider (`app_metadata.provider`), e.g. `"google"` -- drives
   * the Google-only `/telefon` phone gate. */
  provider: string | null;
};

export type SessionRefreshResult = {
  /** The response carrying the refreshed session cookie(s). The caller
   * (`src/middleware.ts`) must return this unmodified on every "allow" path
   * -- replacing it with a fresh `NextResponse.next()` would drop the
   * refreshed cookies and can cause random sign-outs. */
  response: NextResponse;
  /** The signed-in user's locally-verified claims for this request, or `null`
   * if there is no valid session. Resolved via `auth.getClaims()` (local
   * ES256 signature verification against the cached JWKS), NOT `getUser()`'s
   * network round trip to the Auth server. */
  claims: SessionClaims | null;
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

  // Do not run code between `createServerClient` and this auth call. It is
  // required to keep the session cookie fresh; skipping it can cause users to
  // be randomly signed out (per Supabase SSR docs).
  //
  // `getClaims()` verifies the access-token JWT LOCALLY against the project's
  // cached public key (the project uses asymmetric ES256 signing keys), so it
  // avoids `getUser()`'s network round trip to the Auth server on every single
  // request -- the dominant source of navigation latency. It still reads and
  // refreshes the session via `getSession()` internally (preserving the
  // cookie-refresh contract above) AND cryptographically verifies the
  // signature (unlike the insecure bare `getSession()`), so the resolved
  // subject is safe to trust for RLS-scoped reads and access decisions.
  const { data } = await supabase.auth.getClaims();
  const raw = data?.claims ?? null;
  const claims: SessionClaims | null =
    raw && typeof raw.sub === "string"
      ? {
          sub: raw.sub,
          email: typeof raw.email === "string" ? raw.email : null,
          provider:
            (raw.app_metadata as { provider?: string } | undefined)?.provider ??
            null,
        }
      : null;

  return { response: supabaseResponse, claims, supabase };
}
