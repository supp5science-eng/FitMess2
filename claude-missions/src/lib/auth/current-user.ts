import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

/**
 * The signed-in user's id (`sub`) for the current request, resolved by LOCALLY
 * verifying the access-token JWT via `auth.getClaims()` instead of
 * `auth.getUser()`'s network round trip to the Auth server.
 *
 * The project uses asymmetric ES256 signing keys, so `getClaims()` verifies
 * the token's signature against the cached public key (JWKS cached
 * module-globally, fetched once per server instance) with no per-request
 * network call -- while still cryptographically proving the caller's identity,
 * unlike the insecure bare `getSession()`. Postgres RLS ("own-row" policies)
 * independently enforces per-user access at the database, so this id only ever
 * scopes a read/write to its rightful owner.
 *
 * Use this anywhere a Server Component / Server Action / Route Handler only
 * needs "who is the caller" -- which is almost everywhere. Returns `null` when
 * there is no valid session (callers render their own "session expired" state
 * or return 401).
 */
export async function getCurrentUserId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return !error && typeof sub === "string" ? sub : null;
}

/** The subset of access-token claims commonly needed alongside the user id. */
export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Like {@link getCurrentUserId} but also returns the caller's email (present
 * in the token), for the handful of screens that display it (e.g. `/profil`).
 * Same local-verification, no-network guarantees.
 */
export async function getCurrentUser(
  supabase: SupabaseClient<Database>
): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
