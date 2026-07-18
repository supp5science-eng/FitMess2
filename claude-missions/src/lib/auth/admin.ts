import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { SIGNED_OUT_REDIRECT_PATH } from "@/lib/auth/route-protection";
import { createClient } from "@/lib/supabase/server";
import type { Database, Profile } from "@/lib/types/db";

/**
 * F033: the admin gate -- the single server-side seam every `/admin/*` page
 * and every future admin Route Handler / Server Action (F034 foods
 * queue/editor, F035 food editing, F036 users, F075 costs) must go through
 * before touching anything admin-only. This IS the enforcement point
 * (AS-059, AS-067) -- it is never something the UI merely hides behind.
 *
 * `profiles.is_admin` (F010) is set manually in the DB by a human operator;
 * there is no self-serve admin signup anywhere in this codebase.
 */

/** Where an authenticated-but-non-admin visitor to `/admin/*` is sent -- a
 * real Serbian "access denied" page (`src/app/nemas-pristup/page.tsx`),
 * never a raw 404/500. Deliberately NOT nested under `/admin` itself, so
 * `src/app/admin/layout.tsx`'s own `requireAdmin()` call can never redirect
 * a denied visitor back into a loop that re-triggers the same denial. */
export const ADMIN_ACCESS_DENIED_PATH = "/nemas-pristup";

export type AdminSessionResult =
  | { status: "ok"; user: User; profile: Profile }
  | { status: "anonymous" }
  | { status: "not_admin" };

/**
 * The pure DB-decision core: given any already-constructed Supabase client
 * (session-scoped; own-row RLS applies), resolves whether the caller is
 * signed in AND `profiles.is_admin === true`.
 *
 * Deliberately client-injectable -- same pattern `src/lib/auth/core.ts`
 * (F011) established -- rather than hardcoded to the cookie-bound server
 * client, so this is directly testable: unit tests pass a fake client, live
 * integration tests pass a real session-scoped client signed in against the
 * live project (mirrors F013's `route-protection.integration.test.ts`
 * cookie-jar pattern).
 *
 * Reads only the CALLER'S OWN profile row (the `profiles_select_own` RLS
 * policy from F010's migration already allows this) -- no admin-bypass
 * client and no permissive "admins can read everyone's profile" RLS policy
 * is needed just to answer "is THIS caller an admin". F034/F035's actual
 * cross-user admin mutations are a separate concern (see the F033 handoff's
 * "Notes for the next worker") and use `createAdminClient()` *behind* this
 * same gate, never in place of it.
 */
export async function resolveAdminSessionForClient(
  supabase: SupabaseClient<Database>
): Promise<AdminSessionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "anonymous" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile || profile.is_admin !== true) {
    return { status: "not_admin" };
  }

  return { status: "ok", user, profile };
}

/** Server-context convenience wrapper: builds the real cookie-bound client
 * (`@/lib/supabase/server`'s `createClient()`) for the current request and
 * delegates to the pure core above. Only callable inside an actual Next.js
 * request context (Server Component, Server Action, Route Handler) since
 * `createClient()` reads `next/headers`' `cookies()`. */
export async function resolveAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient();
  return resolveAdminSessionForClient(supabase);
}

/**
 * Page/layout guard (AS-059). Call from a Server Component -- this
 * feature's `src/app/admin/layout.tsx` calls it once at the top of every
 * `/admin/*` route. Redirects and NEVER RETURNS for a denied visitor:
 *
 *   - anonymous               -> `/prijava` (same target F013's default-
 *     deny middleware already uses for every other protected route --
 *     single source of truth via `SIGNED_OUT_REDIRECT_PATH`; belt-and-
 *     suspenders here since `/admin` is already protected by that
 *     middleware too, an anonymous request should never actually reach
 *     this line in practice)
 *   - authenticated, not admin -> `ADMIN_ACCESS_DENIED_PATH` (a real
 *     Serbian "Nemaš pristup" page)
 *
 * Returns the resolved `{user, profile}` on success so callers don't need
 * a second query.
 */
export async function requireAdmin(): Promise<{
  user: User;
  profile: Profile;
}> {
  const session = await resolveAdminSession();

  if (session.status === "ok") {
    return { user: session.user, profile: session.profile };
  }
  if (session.status === "anonymous") {
    redirect(SIGNED_OUT_REDIRECT_PATH);
  }
  redirect(ADMIN_ACCESS_DENIED_PATH);
}

export type AdminApiResult =
  | { ok: true; user: User; profile: Profile }
  | { ok: false; status: 401 | 403; error_sr: string };

/**
 * Pure mapping from an already-resolved `AdminSessionResult` to the JSON
 * shape a Route Handler / Server Action should respond with (this
 * feature's inherited API contract: "JSON {ok,error_sr} for actions").
 * Exported separately from `requireAdminApi()` below so it can be exercised
 * directly against a real, live-resolved session in tests without needing
 * a Next.js request context.
 */
export function toAdminApiResult(session: AdminSessionResult): AdminApiResult {
  if (session.status === "ok") {
    return { ok: true, user: session.user, profile: session.profile };
  }
  if (session.status === "anonymous") {
    return {
      ok: false,
      status: 401,
      error_sr: "Moraš biti prijavljen da bi pristupio/la ovoj funkciji.",
    };
  }
  return {
    ok: false,
    status: 403,
    error_sr: "Nemaš administratorski pristup.",
  };
}

/**
 * Route Handler / Server Action guard (AS-067). Unlike `requireAdmin()`,
 * this NEVER redirects -- it always returns, so a Route Handler can turn a
 * denial into a real `NextResponse.json({ok:false,error_sr}, {status})`
 * instead of a page navigation. This is the guard every F034/F035/F036
 * admin mutation Route Handler / Server Action must call FIRST, before
 * touching `createAdminClient()` -- enforcement never depends on the
 * client hiding a button, it depends on this call's result.
 *
 * Example usage inside a future admin Route Handler:
 *
 *   export async function POST(request: Request) {
 *     const guard = await requireAdminApi();
 *     if (!guard.ok) {
 *       return NextResponse.json(
 *         { ok: false, error_sr: guard.error_sr },
 *         { status: guard.status }
 *       );
 *     }
 *     const admin = createAdminClient();
 *     // ...perform the privileged mutation with `admin`...
 *   }
 */
export async function requireAdminApi(): Promise<AdminApiResult> {
  const session = await resolveAdminSession();
  return toAdminApiResult(session);
}
