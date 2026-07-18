// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { GET } from "@/app/api/export/route";
import { persistOnboarding } from "@/lib/onboarding/persist";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";

// F018 / AS-014: the live-project proof that GET /api/export -- called the
// same way F013's `route-protection.integration.test.ts` calls `middleware()`
// directly with a real `NextRequest` carrying real session cookies -- returns
// a JSON download of exactly the calling user's own profile/targets/rules,
// and never another user's data. Follows the `describe.skipIf(!hasCredentials)`
// degrade-gracefully pattern established by F010/F011/F012/F013/F017's live
// integration tests.

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

/** Same in-memory cookie-jar `createServerClient` shape F013/F017's live
 * integration tests use -- signing in through this client produces the same
 * cookie names + base64url-encoded values a real browser session would
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

function makeExportRequest(cookieHeader: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/export", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe.skipIf(!hasCredentials)(
  "F018 / AS-014: GET /api/export on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F018-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    });

    async function createOnboardedUser(
      emailPrefix: string,
      onboardingData: OnboardingData
    ) {
      const email = `${emailPrefix}-${suffix}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({
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
      const { error: signInErr } = await jar.supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      // Seed a real profiles + targets + rules state via the session
      // client, exactly like every other real user reaches this state.
      const result = await persistOnboarding(jar.supabase, userId, onboardingData);
      expect(result.ok).toBe(true);

      return { userId, email, ...jar };
    }

    const OWNER_ONBOARDING: OnboardingData = {
      sex: "female",
      ageYears: 29,
      heightCm: 170,
      weightKg: 82,
      activityLevel: "moderate",
      targetWeightKg: 72,
      timeframeWeeks: 20,
    };

    const OTHER_ONBOARDING: OnboardingData = {
      sex: "male",
      ageYears: 41,
      heightCm: 182,
      weightKg: 95,
      activityLevel: "active",
      targetWeightKg: 85,
      timeframeWeeks: 24,
    };

    it("test_AS_014_an_authenticated_user_downloads_a_json_export_containing_their_own_profile_targets_and_rules", async () => {
      const owner = await createOnboardedUser("f018-owner", OWNER_ONBOARDING);
      const other = await createOnboardedUser("f018-other", OTHER_ONBOARDING);

      const { data: ownerRow } = await admin
        .from("profiles")
        .select("*")
        .eq("user_id", owner.userId)
        .single();
      const { data: ownerTargets } = await admin
        .from("targets")
        .select("*")
        .eq("user_id", owner.userId);
      const { data: otherRow } = await admin
        .from("profiles")
        .select("*")
        .eq("user_id", other.userId)
        .single();

      const response = await GET(makeExportRequest(owner.cookieHeader()));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/application\/json/);
      const disposition = response.headers.get("content-disposition") ?? "";
      expect(disposition).toMatch(/^attachment;/);
      expect(disposition).toMatch(/filename="fitmess-podaci-.*\.json"/);

      const body = (await response.json()) as {
        exported_at: string;
        schema_note: string;
        account: { id: string; email: string | null };
        profile: Record<string, unknown> | null;
        rules: unknown[];
        targets: Record<string, unknown>[];
      };

      // Contains the owner's own data.
      expect(body.account.id).toBe(owner.userId);
      expect(body.account.email).toBe(owner.email);
      expect(body.profile).toMatchObject({
        user_id: owner.userId,
        sex: ownerRow?.sex,
        height_cm: ownerRow?.height_cm,
      });
      expect(body.rules.length).toBeGreaterThanOrEqual(3);
      expect(body.rules.length).toBeLessThanOrEqual(5);
      expect(body.rules).toEqual(ownerRow?.rules);
      expect(body.targets.length).toBe(ownerTargets?.length ?? 0);
      expect(body.targets[0]?.user_id).toBe(owner.userId);
      expect(typeof body.exported_at).toBe("string");
      expect(typeof body.schema_note).toBe("string");
      expect(body.schema_note.length).toBeGreaterThan(0);

      // Never contains the OTHER user's data (own-data-only, AS-013-style).
      expect(body.account.id).not.toBe(other.userId);
      expect(body.account.email).not.toBe(other.email);
      expect(body.profile?.user_id).not.toBe(other.userId);
      const bodyText = JSON.stringify(body);
      expect(bodyText).not.toContain(other.userId);
      expect(bodyText).not.toContain(other.email);
      expect(otherRow?.height_cm).not.toBe(ownerRow?.height_cm); // sanity: profiles actually differ
      for (const target of body.targets) {
        expect(target.user_id).not.toBe(other.userId);
      }
    });

    it("test_AS_014_a_signed_out_request_is_rejected_with_a_serbian_error_and_no_data", async () => {
      const response = await GET(makeExportRequest(""));

      expect(response.status).toBe(401);
      expect(response.headers.get("content-disposition")).toBeNull();

      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      // Serbian, not a raw/technical message.
      expect(body.error_sr).not.toMatch(/error|exception|stack/i);
      expect(JSON.stringify(body)).not.toMatch(/profile|targets|rules/i);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F018: live export route integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_014_blocked", () => {
      console.warn(
        "[F018] Live export-route integration tests for AS-014 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F018-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
