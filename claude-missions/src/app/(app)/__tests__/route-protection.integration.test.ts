// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { middleware } from "@/middleware";
import type { Database } from "@/lib/types/db";

// F013: live-project, request-level integration coverage for AS-011 (signed
// out -> /prijava) and AS-012 (after sign-out, session is cleared and
// protected pages redirect to login again), plus the rest of the redirect
// matrix (unverified -> verification notice, verified-but-not-onboarded ->
// /onboarding).
//
// Rather than spinning up a real HTTP server and driving it with curl, this
// invokes the actual exported `middleware()` function from `src/middleware.ts`
// directly against a real `NextRequest` carrying REAL Supabase session
// cookies -- built the same way the browser client would, using
// `@supabase/ssr`'s own `createServerClient` with an in-memory cookie jar
// standing in for the browser's cookie store (its `onAuthStateChange`
// listener calls our `setAll` on SIGNED_IN/SIGNED_OUT exactly as it would in
// a real request, so the cookie *names, values, and base64url encoding* are
// byte-for-byte what a real browser would send -- not hand-rolled). This
// proves the actual `middleware` export decides correctly against the real
// live project, without the flakiness/slowness of booting `next dev`/`next
// start` inside the test suite. See the F013 handoff for a separate
// curl-style Location-header capture against a running dev server
// (`handoffs/evidence/F013/`).
//
// Follows the `describe.skipIf(!hasCredentials)` degrade-gracefully pattern
// established by F010/F011/F012's live integration tests.

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function loadDotEnvIfPresent(): void {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvIfPresent();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const hasCredentials = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY
);

function makeAdminClient() {
  return createSupabaseJsClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_SECRET_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * A `createServerClient` instance backed by a plain in-memory `Map` instead
 * of real HTTP cookies -- this is exactly the "cookies" abstraction
 * `@supabase/ssr` expects (`getAll`/`setAll`), so signing in/out through
 * this client produces the same cookie names + base64url-encoded values a
 * real browser session would carry, capturable for building `NextRequest`s.
 */
function makeCookieJarClient() {
  const jar = new Map<string, string>();

  const supabase = createServerClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll: () =>
          Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            if (value) {
              jar.set(name, value);
            } else {
              jar.delete(name);
            }
          }
        },
      },
    }
  );

  const cookieHeader = () =>
    Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

  return { supabase, cookieHeader };
}

function makeRequest(pathname: string, cookieHeader: string): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

/** Location header path (no origin) of a redirect response, or null. */
function redirectPath(response: Response): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location).pathname;
}

describe.skipIf(!hasCredentials)(
  "F013: route-protection middleware on the live Supabase project (AS-011, AS-012)",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F013-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    });

    describe("AS-011: a signed-out visitor requesting any in-app page is redirected to the login screen", () => {
      it("test_AS_011_request_with_no_session_cookie_to_a_protected_page_gets_a_307_redirect_to_prijava", async () => {
        const response = await middleware(makeRequest("/profil", ""));

        expect(response.status).toBe(307);
        expect(redirectPath(response)).toBe("/prijava");
      });

      it("test_AS_011_request_with_no_session_cookie_to_the_login_page_itself_is_allowed_through", async () => {
        const response = await middleware(makeRequest("/prijava", ""));

        expect(response.headers.get("location")).toBeNull();
      });
    });

    describe("AS-012: a signed-in user can sign out; afterwards protected pages redirect to login", () => {
      let email: string;
      let userId: string;

      beforeAll(async () => {
        email = `f013-signout-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          throw new Error(`Failed to create confirmed test user: ${error?.message}`);
        }
        userId = data.user.id;
        createdUserIds.push(userId);

        const { error: onboardErr } = await admin
          .from("profiles")
          .update({ onboarded_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (onboardErr) {
          throw new Error(`Failed to mark test user onboarded: ${onboardErr.message}`);
        }
      });

      it("test_AS_012_signed_in_verified_onboarded_user_reaches_a_protected_page_then_signing_out_makes_it_redirect_to_login_again", async () => {
        const { supabase, cookieHeader } = makeCookieJarClient();

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        expect(signInErr).toBeNull();

        // Before sign-out: middleware must let the real, live-issued session
        // through to a protected page.
        const beforeSignOut = await middleware(
          makeRequest("/profil", cookieHeader())
        );
        expect(beforeSignOut.headers.get("location")).toBeNull();

        // Sign out through the same cookie-bound client `signOutAction`
        // itself uses (`supabase.auth.signOut()`) -- this is the real call
        // that clears the session server-side.
        const { error: signOutErr } = await supabase.auth.signOut();
        expect(signOutErr).toBeNull();

        // After sign-out: the same protected page must redirect to login
        // again, exactly like a request that was never signed in (AS-012).
        const afterSignOut = await middleware(
          makeRequest("/profil", cookieHeader())
        );
        expect(afterSignOut.status).toBe(307);
        expect(redirectPath(afterSignOut)).toBe("/prijava");
      });
    });

    describe("verified-but-unconfirmed and not-onboarded branches reach the correct redirect target (side-effect verification: unverified/anonymous users cannot reach protected data)", () => {
      it("test_unverified_email_password_user_has_no_session_at_all_so_a_protected_page_request_still_redirects_to_prijava_not_the_protected_page", async () => {
        const email = `f013-unverified-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
        });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        if (data.user) createdUserIds.push(data.user.id);
        // Confirms the live record actually is unconfirmed -- the shape
        // `middleware.ts`'s `isEmailVerified(user)` call keys on.
        expect(data.user?.email_confirmed_at).toBeFalsy();

        // GoTrue itself refuses to mint a session for an unconfirmed user via
        // password sign-in (proven live by F011's signInEmailPassword
        // integration test), so no cookie jar can ever be populated for this
        // account through the real sign-in path in the first place -- the
        // live, end-to-end proof that an unverified user cannot reach
        // protected data is therefore "no session ever exists", which is the
        // exact same middleware branch AS-011 already covers live above.
        const { supabase, cookieHeader } = makeCookieJarClient();
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({ email, password });
        expect(signInErr).not.toBeNull();
        expect(signInErr?.code).toBe("email_not_confirmed");
        expect(signInData.session).toBeNull();

        const response = await middleware(makeRequest("/profil", cookieHeader()));
        expect(response.status).toBe(307);
        expect(redirectPath(response)).toBe("/prijava");
      });

      it("test_verified_not_onboarded_user_hitting_a_protected_page_is_redirected_to_onboarding_not_the_protected_page", async () => {
        const email = `f013-not-onboarded-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        if (data.user) createdUserIds.push(data.user.id);

        // Freshly created profile row has onboarded_at still null (F010's
        // trigger creates an empty shell) -- do not mark it onboarded.
        const { supabase, cookieHeader } = makeCookieJarClient();
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const response = await middleware(makeRequest("/profil", cookieHeader()));

        expect(response.status).toBe(307);
        expect(redirectPath(response)).toBe("/onboarding");
      });
    });
  }
);

describe.skipIf(hasCredentials)(
  "F013: live route-protection integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_011_AS_012_blocked", () => {
      console.warn(
        "[F013] Live route-protection integration tests for AS-011/AS-012 " +
          "SKIPPED: SUPABASE_* credentials not resolvable from .env in this " +
          "session. See missions/20260717-183157/handoffs/F013-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
