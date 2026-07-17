// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { middleware } from "@/middleware";
import type { Database } from "@/lib/types/db";

// F015 / AS-018: "A newly verified user is routed through onboarding before
// reaching the home screen." F013 already proved the general
// verified-but-not-onboarded -> /onboarding redirect against a generic
// protected page (`/profil`); this file adds F015's own live proof against
// the actual home screen (`/danas`) specifically -- the exact path AS-018
// names -- plus the other half of "routed through" (AS-018) and "cannot
// bypass it" (clarified scope): that `/onboarding` itself is NOT redirected
// away from for the same not-onboarded user (no redirect loop, the wizard
// is actually reachable), and that a fully onboarded user is no longer sent
// there.
//
// Same live-project, cookie-jar pattern F013 established (see that file's
// header comment for the full rationale) -- reused here rather than
// reinvented.

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

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

function redirectPath(response: Response): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location).pathname;
}

describe.skipIf(!hasCredentials)(
  "F015: AS-018 -- a verified, not-yet-onboarded user is routed through /onboarding before reaching /danas",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F015-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    });

    describe("a verified, not-onboarded user", () => {
      let email: string;
      let cookieHeader: () => string;

      beforeAll(async () => {
        email = `f015-onboarding-gate-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          throw new Error(`Failed to create confirmed test user: ${error?.message}`);
        }
        createdUserIds.push(data.user.id);
        // Freshly created profile row has onboarded_at still null (F010's
        // trigger creates an empty shell) -- do not mark it onboarded.

        const jar = makeCookieJarClient();
        const { error: signInErr } = await jar.supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);
        cookieHeader = jar.cookieHeader;
      });

      it("test_AS_018_requesting_danas_the_home_screen_redirects_to_onboarding_not_danas", async () => {
        const response = await middleware(makeRequest("/danas", cookieHeader()));

        expect(response.status).toBe(307);
        expect(redirectPath(response)).toBe("/onboarding");
      });

      it("test_AS_018_onboarding_itself_is_allowed_through_no_redirect_loop_the_wizard_is_reachable", async () => {
        const response = await middleware(
          makeRequest("/onboarding", cookieHeader())
        );

        // Allowed through -- no Location header at all.
        expect(response.headers.get("location")).toBeNull();
      });

      it("test_AS_018_a_not_onboarded_user_cannot_bypass_the_gate_by_requesting_danas_directly", async () => {
        // Re-affirms the bypass-prevention half of AS-018 explicitly: even a
        // direct request for the home screen never reaches it while
        // onboarded_at is null.
        const response = await middleware(makeRequest("/danas", cookieHeader()));
        expect(redirectPath(response)).not.toBe("/danas");
        expect(redirectPath(response)).toBe("/onboarding");
      });
    });

    describe("a verified, already-onboarded user", () => {
      it("test_AS_018_an_onboarded_user_requesting_danas_is_allowed_through_not_sent_back_to_onboarding", async () => {
        const email = `f015-already-onboarded-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        if (data.user) createdUserIds.push(data.user.id);

        const { error: onboardErr } = await admin
          .from("profiles")
          .update({ onboarded_at: new Date().toISOString() })
          .eq("user_id", data.user!.id);
        expect(onboardErr).toBeNull();

        const jar = makeCookieJarClient();
        const { error: signInErr } = await jar.supabase.auth.signInWithPassword({
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const response = await middleware(
          makeRequest("/danas", jar.cookieHeader())
        );
        expect(response.headers.get("location")).toBeNull();
      });
    });
  }
);

describe.skipIf(hasCredentials)(
  "F015: live onboarding-route integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_018_blocked", () => {
      console.warn(
        "[F015] Live onboarding-route integration tests for AS-018 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F015-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
