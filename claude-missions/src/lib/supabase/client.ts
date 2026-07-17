import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Uses the `sb_publishable_` key, which (like the legacy `anon` key it
 * replaces) is designed to be shipped to the browser -- Postgres RLS is
 * what actually protects rows, not secrecy of this key.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is inlined into the client bundle by Next.js
 * automatically because of its `NEXT_PUBLIC_` prefix. `SUPABASE_PUBLISHABLE_KEY`
 * has no such prefix in `.env` (it was provisioned that way during
 * `/mission-connect` and must not be renamed there), so it is re-exposed to
 * the client bundle via the `env` block in `next.config.ts` instead.
 *
 * Never import `SUPABASE_SECRET_KEY` here or anywhere under a `"use client"`
 * boundary -- it must stay server-only (see `./server.ts`).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!
  );
}
