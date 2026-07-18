// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import {
  resolveAdminSessionForClient,
  toAdminApiResult,
} from "@/lib/auth/admin";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";

// F033: live-project integration coverage for AS-059 (only an
// `is_admin=true` profile can pass the admin gate; anonymous and non-admin
// sessions are denied) and AS-067 (the SAME guard function a Route
// Handler/Server Action would call rejects a non-admin session with a
// 403-shaped result, independent of any UI). Mirrors F013's
// `route-protection.integration.test.ts` cookie-jar pattern: real Supabase
// Auth sessions signed in against the live project, no mocking of Supabase
// itself.
//
// Per `missions/20260717-183157/connections/mcp-registry.md`, `mcp__
// supabase__*` tools are NOT bound inside worker subagents -- the
// `is_admin` flip uses the Supabase Management API SQL endpoint
// (`POST /v1/projects/{ref}/database/query`) with `SUPABASE_ACCESS_TOKEN`/
// `SUPABASE_PROJECT_REF`, exactly as documented there, rather than the
// `sb_secret_` admin client (which would also work, but the run
// instructions for this feature explicitly call for the Management API
// path for this live DB mutation).

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
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

const hasSupabaseCredentials = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY
);
const hasManagementCredentials = Boolean(
  SUPABASE_ACCESS_TOKEN && SUPABASE_PROJECT_REF
);
const hasCredentials = hasSupabaseCredentials && hasManagementCredentials;

function makeAdminClient() {
  return createSupabaseJsClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_SECRET_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Same in-memory-cookie-jar `createServerClient` pattern F013 established
 * -- produces byte-for-byte the same session cookies a real browser would,
 * without booting an HTTP server. */
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

  return { supabase };
}

/** Runs a raw SQL statement against the live project via the Supabase
 * Management API's `database/query` endpoint (documented in
 * `mcp-registry.md`) -- used here only to flip `is_admin`, mirroring what a
 * human operator manually setting the flag in the DB would do. */
async function managementApiQuery(query: string): Promise<void> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Management API query failed (${res.status}): ${body.slice(0, 500)}`
    );
  }
}

describe.skipIf(!hasCredentials)(
  "F033: the admin gate against the live Supabase project (AS-059, AS-067)",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F033-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      // Reset is_admin back to false before deleting, so no lingering
      // admin-flagged row survives even if deletion below ever fails.
      for (const id of createdUserIds) {
        await managementApiQuery(
          `update public.profiles set is_admin = false where user_id = '${id}'`
        ).catch(() => {});
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    describe("AS-059: anonymous session never resolves as admin", () => {
      it("test_AS_059_no_signed_in_session_resolves_anonymous_not_ok", async () => {
        const { supabase } = makeCookieJarClient(); // never signed in
        const result = await resolveAdminSessionForClient(supabase);
        expect(result).toEqual({ status: "anonymous" });
      });
    });

    describe("AS-059 / AS-067: a normal user (is_admin default false) is denied, flipping is_admin=true grants access", () => {
      let email: string;
      let userId: string;

      beforeAll(async () => {
        email = `f033-admin-gate-${suffix}@example.com`;
        const { data, error } = await adminCreateUserRetry(admin, {
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          throw new Error(
            `Failed to create confirmed test user: ${error?.message}`
          );
        }
        userId = data.user.id;
        createdUserIds.push(userId);
      });

      it("test_AS_059_freshly_created_user_has_is_admin_false_by_default_and_is_denied_the_admin_gate", async () => {
        const { supabase } = makeCookieJarClient();
        const { error: signInErr } = await signInWithPasswordRetry(supabase, {
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const result = await resolveAdminSessionForClient(supabase);
        expect(result).toEqual({ status: "not_admin" });
      });

      it("test_AS_067_the_same_non_admin_session_maps_to_a_403_json_shaped_denial_via_the_route_handler_facing_guard", async () => {
        const { supabase } = makeCookieJarClient();
        const { error: signInErr } = await signInWithPasswordRetry(supabase, {
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const session = await resolveAdminSessionForClient(supabase);
        const apiResult = toAdminApiResult(session);

        expect(apiResult.ok).toBe(false);
        if (!apiResult.ok) {
          expect(apiResult.status).toBe(403);
          expect(apiResult.error_sr.length).toBeGreaterThan(0);
        }
      });

      it("test_AS_059_flipping_is_admin_true_via_the_management_api_lets_the_same_user_pass_the_gate", async () => {
        // Flip via the Management API SQL endpoint -- the equivalent of a
        // human operator manually setting the flag in the DB (per
        // discovery: no self-serve admin signup path exists).
        await managementApiQuery(
          `update public.profiles set is_admin = true where user_id = '${userId}'`
        );

        const { supabase } = makeCookieJarClient();
        const { error: signInErr } = await signInWithPasswordRetry(supabase, {
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const result = await resolveAdminSessionForClient(supabase);
        expect(result.status).toBe("ok");
        if (result.status === "ok") {
          expect(result.user.id).toBe(userId);
          expect(result.profile.is_admin).toBe(true);

          const apiResult = toAdminApiResult(result);
          expect(apiResult).toEqual({
            ok: true,
            user: result.user,
            profile: result.profile,
          });
        }

        // Reset back to false immediately -- the rest of this describe
        // block's tests (and any other test user created with this email
        // prefix) should never accidentally observe a lingering admin.
        await managementApiQuery(
          `update public.profiles set is_admin = false where user_id = '${userId}'`
        );
      });
    });
  }
);

describe.skipIf(hasCredentials)(
  "F033: live admin-gate integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_059_AS_067_blocked", () => {
      console.warn(
        "[F033] Live admin-gate integration tests for AS-059/AS-067 " +
          "SKIPPED: SUPABASE_*/SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF " +
          "not all resolvable from .env in this session. See " +
          "missions/20260717-183157/handoffs/F033-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
