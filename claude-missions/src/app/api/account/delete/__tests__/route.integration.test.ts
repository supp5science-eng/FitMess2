// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/account/delete/route";
import { deleteAccount } from "@/lib/account/delete-account";
import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";
import { persistOnboarding } from "@/lib/onboarding/persist";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";

// F019 / AS-015, AS-016: the live-project proof that `POST
// /api/account/delete` -- called the same way F013/F018's live integration
// tests call `middleware()`/`GET` directly with a real `NextRequest` carrying
// real session cookies -- actually removes the calling user's own
// profiles/targets rows AND the auth user itself (AS-015), and that
// afterwards the deleted credentials no longer authenticate at all
// (AS-016). Follows the `describe.skipIf(!hasCredentials)` degrade-
// gracefully pattern established by F010/F011/F012/F013/F017/F018's live
// integration tests.

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");

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

/** Same in-memory cookie-jar `createServerClient` shape F013/F017/F018's
 * live integration tests use -- signing in through this client produces the
 * same cookie names + base64url-encoded values a real browser session would
 * carry, capturable for building `NextRequest`s. */
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

function makeDeleteRequest(cookieHeader: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/account/delete", {
    method: "POST",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const ONBOARDING_DATA: OnboardingData = {
  sex: "female",
  ageYears: 31,
  heightCm: 165,
  weightKg: 70,
  activityLevel: "light",
  goal: "lose",
  targetWeightKg: 62,
  timeframeWeeks: 16,
};

describe.skipIf(!hasCredentials)(
  "F019 / AS-015, AS-016: POST /api/account/delete on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F019-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      // Best-effort cleanup for any test user this run did NOT already
      // delete via the code path under test (e.g. a failure-path test).
      for (const id of createdUserIds) {
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    async function createOnboardedUser(emailPrefix: string) {
      const email = `${emailPrefix}-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create confirmed test user: ${error?.message}`);
      }
      const userId = data.user.id;
      createdUserIds.push(userId);

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      // Seed a real profiles + targets + rules state via the session
      // client, exactly like every other real user reaches this state.
      const result = await persistOnboarding(jar.supabase, userId, ONBOARDING_DATA);
      expect(result.ok).toBe(true);

      return { userId, email, ...jar };
    }

    it("test_AS_015_deleting_the_account_removes_the_profiles_and_targets_rows_and_the_auth_user_itself", async () => {
      const user = await createOnboardedUser("f019-delete");

      // Sanity: the rows actually exist before deletion.
      const { data: profileBefore } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.userId)
        .maybeSingle();
      expect(profileBefore?.user_id).toBe(user.userId);
      const { data: targetsBefore } = await admin
        .from("targets")
        .select("id")
        .eq("user_id", user.userId);
      expect((targetsBefore?.length ?? 0)).toBeGreaterThan(0);

      const response = await POST(
        makeDeleteRequest(user.cookieHeader(), { confirm: DELETE_CONFIRMATION_PHRASE })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: unknown };
      expect(body.ok).toBe(true);

      // AS-015: the personal-data rows are gone.
      const { data: profileAfter, error: profileAfterErr } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.userId)
        .maybeSingle();
      expect(profileAfterErr).toBeNull();
      expect(profileAfter).toBeNull();

      const { data: targetsAfter, error: targetsAfterErr } = await admin
        .from("targets")
        .select("id")
        .eq("user_id", user.userId);
      expect(targetsAfterErr).toBeNull();
      expect(targetsAfter).toEqual([]);

      // AS-015: the auth user itself is gone (not just its data rows).
      const { data: usersPage } = await admin.auth.admin.listUsers();
      expect(usersPage?.users.find((u) => u.id === user.userId)).toBeUndefined();

      // AS-016: the deleted credentials no longer authenticate at all.
      // NOTE: this sign-in is EXPECTED to fail (invalid_credentials, the
      // account no longer exists) -- `signInWithPasswordRetry` still
      // correctly passes it through unretried, since that's a real error,
      // not a rate-limit-shaped one.
      const freshClient = makeCookieJarClient();
      const { data: signInAfterDelete, error: signInAfterDeleteErr } =
        await signInWithPasswordRetry(freshClient.supabase, {
          email: user.email,
          password,
        });
      expect(signInAfterDeleteErr).not.toBeNull();
      expect(signInAfterDelete.session).toBeNull();
      expect(signInAfterDelete.user).toBeNull();

      // Already deleted by the route under test -- don't try again in
      // `afterAll` (harmless if we did, `deleteUser` on a missing id just
      // errors, swallowed by the `.catch(() => {})` there).
    });

    it("test_AS_015_a_wrong_confirmation_phrase_is_rejected_with_400_and_deletes_nothing_no_partial_write", async () => {
      const user = await createOnboardedUser("f019-wrong-confirm");

      const response = await POST(
        makeDeleteRequest(user.cookieHeader(), { confirm: "pogresno" })
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      expect(body.error_sr).not.toMatch(/error|exception|stack/i);

      // No partial write: profile, targets, and the auth user itself all
      // still exist, completely untouched.
      const { data: profileAfter } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.userId)
        .maybeSingle();
      expect(profileAfter?.user_id).toBe(user.userId);

      const { data: targetsAfter } = await admin
        .from("targets")
        .select("id")
        .eq("user_id", user.userId);
      expect((targetsAfter?.length ?? 0)).toBeGreaterThan(0);

      const { data: usersPage } = await admin.auth.admin.listUsers();
      expect(usersPage?.users.find((u) => u.id === user.userId)).toBeDefined();

      // The account can still sign in normally -- nothing was revoked.
      const stillWorks = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(stillWorks.supabase, {
        email: user.email,
        password,
      });
      expect(signInErr).toBeNull();
    });

    it("test_AS_015_a_signed_out_request_is_rejected_with_401_and_deletes_nothing", async () => {
      const response = await POST(
        makeDeleteRequest("", { confirm: DELETE_CONFIRMATION_PHRASE })
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
    });

    it("test_AS_015_a_user_can_only_ever_delete_their_own_account_never_another_users_no_userId_field_is_accepted", async () => {
      const owner = await createOnboardedUser("f019-owner");
      const other = await createOnboardedUser("f019-other");

      // Attempt to smuggle the OTHER user's id into the request body --
      // the route has no `userId` field at all; it must ignore this and
      // only ever act on the caller's own session-resolved id.
      const response = await POST(
        makeDeleteRequest(owner.cookieHeader(), {
          confirm: DELETE_CONFIRMATION_PHRASE,
          userId: other.userId,
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      // Owner is gone.
      const { data: usersPage } = await admin.auth.admin.listUsers();
      expect(usersPage?.users.find((u) => u.id === owner.userId)).toBeUndefined();

      // The OTHER user is completely untouched.
      expect(usersPage?.users.find((u) => u.id === other.userId)).toBeDefined();
      const { data: otherProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", other.userId)
        .maybeSingle();
      expect(otherProfile?.user_id).toBe(other.userId);
    });

    it("test_AS_015_calling_deleteAccount_directly_for_an_already_deleted_user_returns_a_serbian_error_no_throw", async () => {
      // Direct coverage of `deleteAccount`'s live failure path (definition-
      // of-done "failure test" against the real project, not a mock): the
      // admin client really does return an error for a user id that no
      // longer exists.
      const user = await createOnboardedUser("f019-double-delete");

      const first = await deleteAccount(admin, user.userId);
      expect(first.ok).toBe(true);

      const second = await deleteAccount(admin, user.userId);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error_sr.length).toBeGreaterThan(0);
        expect(second.error_sr).not.toMatch(/error|exception|stack|not found/i);
      }
    });
  }
);

describe.skipIf(hasCredentials)(
  "F019: live account-delete route integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_015_AS_016_blocked", () => {
      console.warn(
        "[F019] Live account-delete route integration tests for " +
          "AS-015/AS-016 SKIPPED: SUPABASE_* credentials not resolvable " +
          "from .env in this session. See " +
          "missions/20260717-183157/handoffs/F019-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
