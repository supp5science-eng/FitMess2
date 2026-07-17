"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * F013 / AS-012: signs the current user out and clears their session.
 *
 * Thin `"use server"` wrapper, matching F011's `signInAction`/`signUpAction`
 * pattern: the cookie-bound client's `signOut()` call itself does the real
 * work (Supabase Auth invalidates the session and, via `createClient()`'s
 * `setAll`, clears the HTTP-only session cookie(s) on the response), then
 * `redirect()` sends the now-signed-out visitor to `/prijava`. From there,
 * `src/middleware.ts`'s route-protection boundary (AS-011's same
 * unauthenticated-redirect branch) is what keeps every protected page
 * unreachable afterwards -- this action does not need to know which pages
 * are protected, only to clear the session.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/prijava");
}
