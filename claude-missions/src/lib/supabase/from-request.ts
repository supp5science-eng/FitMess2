import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import type { Database } from "@/lib/types/db";

/**
 * A Supabase client for a route handler that may be called by EITHER front end.
 *
 * The site authenticates with cookies, because that is what a browser sends
 * and what Next.js middleware reads. The native app has no cookie jar: its
 * session lives in the phone's keychain and rides on an `Authorization:
 * Bearer` header, the way every native client talks to an HTTP API.
 *
 * Rather than fork every route into a web one and a native one, this builds
 * the right client from whichever the request carries. The RLS policies do not
 * change, `getCurrentUserId` does not change, and a route that switches to
 * this keeps working for the website exactly as before — the cookie path below
 * is the same code it had.
 *
 * ORDER MATTERS. The header is checked first, and deliberately: a phone that
 * has ever loaded fitmess.app in an in-app browser can hold stale auth cookies
 * for the same domain, and preferring those over the token the app just sent
 * would sign the user in as whoever used that web view last.
 *
 * `setAll` is a no-op in both paths. A route handler that responds with JSON
 * has no way to hand a refreshed cookie back to a native client, and the app
 * refreshes its own token (`AppState` in `fitmess-app/src/lib/supabase.ts`).
 * Session refresh for the WEBSITE keeps happening where it always has, in
 * middleware.
 */
export function createClientFromRequest(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  const token = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice("bearer ".length).trim()
    : null;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // With a token present the cookie jar is deliberately empty, so there
        // is no chance of the two identities being mixed within one request.
        getAll: () => (token ? [] : request.cookies.getAll()),
        setAll: () => {},
      },
      ...(token
        ? { global: { headers: { Authorization: `Bearer ${token}` } } }
        : {}),
    }
  );
}

/** True when the caller is the native app rather than the website. Useful for
 *  the handful of responses that differ (a deep link instead of a redirect). */
export function isNativeCaller(request: NextRequest): boolean {
  return !!request.headers.get("authorization");
}
