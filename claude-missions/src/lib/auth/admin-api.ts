import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import {
  resolveAdminSessionForClient,
  toAdminApiResult,
  type AdminApiResult,
} from "@/lib/auth/admin";
import type { Database } from "@/lib/types/db";

/**
 * Resolves the admin guard (AS-067) for a Route Handler straight from its
 * `request.cookies`, returning the same `{ok, ...}` `AdminApiResult` shape
 * `requireAdminApi()` produces. This is the exact request-scoped-client
 * pattern F034's verify/remove routes each inlined; the F035 routes
 * (create/update/restore) share this single copy instead. `next/headers`'
 * `cookies()` is deliberately NOT used, so a handler stays directly callable
 * from a Vitest process with a hand-built `NextRequest`.
 */
export async function resolveAdminApiFromRequest(
  request: NextRequest
): Promise<AdminApiResult> {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // No-op: these admin mutations never refresh/write the session cookie.
        setAll: () => {},
      },
    }
  );
  return toAdminApiResult(await resolveAdminSessionForClient(supabase));
}
