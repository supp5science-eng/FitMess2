// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { persistOnboarding } from "@/lib/onboarding/persist";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";

// F017 / AS-028: the live-project proof that completing onboarding actually
// persists 3-5 generated Serbian eating rules to the real `profiles.rules`
// column (supabase/migrations/0003_eating_rules.sql) -- not just that the
// in-memory write payload looks right (that's
// `src/lib/onboarding/__tests__/persist.test.ts`'s job with a mock client).
//
// Reuses the exact live-integration pattern F016's
// `src/app/(app)/onboarding/pregled/__tests__/actions.integration.test.ts`
// established: a real admin-created verified user, a real signed-in
// cookie-jar session client (never the admin client for the write itself,
// so Postgres RLS is what's actually proven, not application code trusting
// a user id), `persistOnboarding` called directly (the same function the
// `"use server"` action calls), then the admin client re-reads the row to
// confirm what actually landed in the database.

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

const ONBOARDING_DATA: OnboardingData = {
  sex: "male",
  ageYears: 34,
  heightCm: 182,
  weightKg: 95,
  activityLevel: "very_active",
  targetWeightKg: 83,
  timeframeWeeks: 20,
};

describe.skipIf(!hasCredentials)(
  "F017 / AS-028: onboarding completion persists 3-5 generated Serbian rules to the live project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F017-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    let userId: string;

    beforeAll(async () => {
      const email = `f017-rules-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create confirmed test user: ${error?.message}`);
      }
      userId = data.user.id;
      createdUserIds.push(userId);

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      const result = await persistOnboarding(jar.supabase, userId, ONBOARDING_DATA);
      expect(result.ok).toBe(true);
    });

    it("test_AS_028_the_persisted_profiles_row_has_between_3_and_5_rules", async () => {
      const { data, error } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();

      expect(error).toBeNull();
      const rules = data?.rules ?? [];
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(3);
      expect(rules.length).toBeLessThanOrEqual(5);
    });

    it("test_AS_028_every_persisted_rule_has_serbian_text_a_stable_id_and_starts_enabled", async () => {
      const { data, error } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();

      expect(error).toBeNull();
      const rules = data?.rules ?? [];
      for (const rule of rules) {
        expect(typeof rule.id).toBe("string");
        expect(rule.id.length).toBeGreaterThan(0);
        expect(typeof rule.textSr).toBe("string");
        expect(rule.textSr.length).toBeGreaterThan(0);
        expect(rule.enabled).toBe(true);
      }
    });
  }
);

describe.skipIf(hasCredentials)(
  "F017: live onboarding-rules integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_028_blocked", () => {
      console.warn(
        "[F017] Live onboarding-rules integration tests for AS-028 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F017-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
