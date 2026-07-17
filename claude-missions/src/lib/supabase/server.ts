import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client scoped to the signed-in user's session.
 *
 * Uses the `sb_publishable_` key (the same key the browser client uses) plus
 * the request's cookies, so Postgres RLS ("own-row" policies, see
 * `tech-decisions.md` -> Conventions -> Database) is enforced by the
 * database itself from the caller's JWT -- not bypassed. Use this for
 * anything in a Server Component, Server Action, or Route Handler that
 * should only ever see "the current user"'s rows (AS-013).
 *
 * Must be called per-request (it reads the request's cookies), so it is
 * async and cannot be module-level singleton state.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` was called from a Server Component, which cannot
            // write cookies. Safe to ignore as long as the session-refresh
            // middleware (see ./middleware.ts) is wired into the app.
          }
        },
      },
    }
  );
}

/**
 * Privileged, server-only Supabase client using the `sb_secret_` key.
 *
 * Bypasses RLS entirely. Never import this from client code, never expose
 * its result to the browser, and never use it for anything scoped to "the
 * current user" -- use `createClient()` above for that. Reserved for
 * admin-only server code (AS-059..AS-067) and privileged background jobs
 * (e.g. conversation summarization, AS-096) that must act across every
 * user's rows.
 *
 * Deliberately built with the plain `@supabase/supabase-js` client rather
 * than `createServerClient` + cookies: this client is not tied to any
 * signed-in user's session, so there is no session to read or refresh.
 */
export function createAdminClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
