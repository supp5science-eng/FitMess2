import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie for a request and returns the
 * response that should be sent back.
 *
 * This is a session-refresh helper only -- it does not decide which routes
 * require authentication or perform any redirect. The route-protection
 * feature that implements the signed-out-redirect behaviour should add a
 * root `src/middleware.ts` that calls this, e.g.:
 *
 *   import { updateSession } from "@/lib/supabase/middleware";
 *   import type { NextRequest } from "next/server";
 *
 *   export async function middleware(request: NextRequest) {
 *     return updateSession(request);
 *   }
 *
 *   export const config = {
 *     matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
 *   };
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
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
  await supabase.auth.getUser();

  return supabaseResponse;
}
