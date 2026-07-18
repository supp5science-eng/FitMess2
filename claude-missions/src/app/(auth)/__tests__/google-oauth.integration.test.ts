// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { isEmailVerified } from "@/lib/auth/core";
import { adminCreateUserRetry, adminDeleteUserRetry } from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";

// F012: live-project integration coverage for AS-010 (Google OAuth
// sign-in), for everything that IS automatable without a real interactive
// Google consent screen (no test Google account / headless consent flow is
// available to this worker session -- see the F012 handoff for exactly what
// remains manual-QA-only):
//
//   (b) the Google provider is actually enabled on the live Supabase
//       project (`external_google_enabled === true`), via the same
//       Management API `/config/auth` endpoint F011 used to read the
//       project's mailer/rate-limit config.
//   (c) an OAuth-authenticated identity (simulated via the admin API with
//       `email_confirm: true` and `app_metadata.provider: "google"`, since
//       Google itself already verified this user's email before GoTrue ever
//       saw them) passes the shared confirmation gate (`isEmailVerified`,
//       keyed on `email_confirmed_at`, never on provider) and gets an
//       auto-created `public.profiles` row from the same trigger F011 built
//       (`supabase/migrations/0002_profiles_on_signup.sql`, which is
//       provider-agnostic by construction -- it fires on any `auth.users`
//       insert).
//
// (a) -- the button renders and invokes `signInWithOAuth` with the right
// provider/redirectTo -- is covered separately in
// `google-oauth.test.tsx` (a jsdom component test, no live project needed).
//
// Follows the same `describe.skipIf` degrade-gracefully pattern F010/F011
// established so this file never hard-crashes a worker session without
// `.env` populated.

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
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

const hasAdminCredentials = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
const hasManagementCredentials = Boolean(
  SUPABASE_ACCESS_TOKEN && SUPABASE_PROJECT_REF
);

function makeAdminClient() {
  return createSupabaseJsClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_SECRET_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

describe.skipIf(!hasManagementCredentials)(
  "AS-010: the Google OAuth provider is enabled on the live Supabase project",
  () => {
    it("test_AS_010_external_google_enabled_is_true_on_the_live_project", async () => {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          },
        }
      );
      expect(res.status).toBe(200);

      const config = (await res.json()) as Record<string, unknown>;
      expect(config.external_google_enabled).toBe(true);
    });
  }
);

describe.skipIf(hasManagementCredentials)(
  "AS-010: live Management API check currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_management_api_credentials_unreachable_AS_010_blocked", () => {
      console.warn(
        "[F012] Live external_google_enabled check for AS-010 SKIPPED: " +
          "SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF not resolvable from " +
          ".env in this session. See " +
          "missions/20260717-183157/handoffs/F012-handoff.md."
      );
      expect(hasManagementCredentials).toBe(false);
    });
  }
);

describe.skipIf(!hasAdminCredentials)(
  "AS-010: a Google-authenticated identity passes the confirmation gate and gets a profiles row",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    let googleUserId: string;
    let googleEmail: string;

    beforeAll(async () => {
      // Simulates what GoTrue itself produces for a real Google OAuth
      // sign-in: `email_confirm: true` (Google already verified this
      // address; GoTrue never leaves `email_confirmed_at` null for an OAuth
      // identity) and `app_metadata.provider: "google"` (the actual shape
      // Supabase stores for an OAuth-created identity). No email is sent by
      // this call.
      googleEmail = `f012-google-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email: googleEmail,
        email_confirm: true,
        app_metadata: { provider: "google", providers: ["google"] },
      });
      if (error || !data.user) {
        throw new Error(
          `Failed to create simulated Google-OAuth test user: ${error?.message}`
        );
      }
      googleUserId = data.user.id;
      createdUserIds.push(googleUserId);
    });

    it("test_AS_010_google_identity_has_email_confirmed_at_set_by_supabase_itself", async () => {
      const { data, error } = await admin.auth.admin.getUserById(
        googleUserId
      );
      expect(error).toBeNull();
      expect(data.user?.email_confirmed_at).toBeTruthy();
      expect(data.user?.app_metadata?.provider).toBe("google");
    });

    it("test_AS_010_google_identity_passes_the_shared_confirmation_gate_which_keys_on_email_confirmed_at_not_provider", async () => {
      const { data, error } = await admin.auth.admin.getUserById(
        googleUserId
      );
      expect(error).toBeNull();

      // The same `isEmailVerified` gate `signInEmailPassword` uses --
      // proves the gate does not need to know or care that this identity's
      // provider is "google" rather than "email".
      expect(isEmailVerified(data.user)).toBe(true);
    });

    it("test_AS_010_google_identity_gets_an_auto_created_profiles_row_from_the_provider_agnostic_trigger", async () => {
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", googleUserId)
        .single();

      expect(profileErr).toBeNull();
      expect(profile?.user_id).toBe(googleUserId);
    });

    it("test_AS_010_unconfirmed_email_password_identity_does_not_pass_the_same_gate", async () => {
      // Negative control: proves the gate is actually discriminating on
      // `email_confirmed_at`, not just always returning true.
      const unconfirmedEmail = `f012-unconfirmed-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email: unconfirmedEmail,
        password: `F012-Test-${suffix}!aA`,
        email_confirm: false,
      });
      if (error || !data.user) {
        throw new Error(
          `Failed to create unconfirmed test user: ${error?.message}`
        );
      }
      createdUserIds.push(data.user.id);

      expect(isEmailVerified(data.user)).toBe(false);
    });
  }
);

describe.skipIf(hasAdminCredentials)(
  "AS-010: live admin-API confirmation-gate check currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_admin_credentials_unreachable_AS_010_blocked", () => {
      console.warn(
        "[F012] Live confirmation-gate/profiles-trigger check for AS-010 " +
          "SKIPPED: SUPABASE_* credentials not resolvable from .env in " +
          "this session. See " +
          "missions/20260717-183157/handoffs/F012-handoff.md."
      );
      expect(hasAdminCredentials).toBe(false);
    });
  }
);
