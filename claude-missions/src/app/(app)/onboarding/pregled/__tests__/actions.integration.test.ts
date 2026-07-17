// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { middleware } from "@/middleware";
import { persistOnboarding } from "@/lib/onboarding/persist";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";

// F016 / AS-020, AS-031: the live-project proof that confirming the
// onboarding summary actually persists.
//
// Exercises `persistOnboarding` (the same function
// `src/app/(app)/onboarding/pregled/actions.ts`'s `"use server"` action
// calls) directly against a REAL signed-in session client, following the
// exact cookie-jar pattern F013/F015 established (see those files' header
// comments for the full rationale) rather than the admin client -- this is
// what proves the write goes through as "the signed-in user", with RLS
// actually enforcing it, not just application code trusting a user id.
//
// AS-020 ("editing a value ... changes the saved values"): calls
// `persistOnboarding` twice for the same user with different edited
// inputs, and asserts the persisted `targets` row reflects the *edited*
// values' recomputed budget, not the original hand-off's.
//
// AS-031 ("a returning user who completed onboarding lands on the home
// screen, not onboarding"): after `persistOnboarding` succeeds,
// `profiles.onboarded_at` is non-null, a `targets` row exists, and a fresh
// sign-in (the F013 middleware, driven with a brand-new cookie jar exactly
// like a second real login would produce) now allows `/danas` through
// instead of bouncing to `/onboarding`.

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

const BASE_ONBOARDING_DATA: OnboardingData = {
  sex: "female",
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  activityLevel: "sedentary",
  targetWeightKg: 76,
  timeframeWeeks: 20,
};

describe.skipIf(!hasCredentials)(
  "F016: confirming the onboarding summary persists (AS-020, AS-031) against the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F016-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
      }
    });

    describe("AS-031: confirming persists onboarded_at + a targets row, and flips the F013 gate", () => {
      let userId: string;
      let email: string;
      let cookieHeader: () => string;

      beforeAll(async () => {
        email = `f016-onboarding-save-${suffix}@example.com`;
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

        const jar = makeCookieJarClient();
        const { error: signInErr } = await jar.supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);
        cookieHeader = jar.cookieHeader;

        // Precondition: still not onboarded, gate still redirects.
        const preResponse = await middleware(makeRequest("/danas", cookieHeader()));
        expect(redirectPath(preResponse)).toBe("/onboarding");

        const result = await persistOnboarding(jar.supabase, userId, BASE_ONBOARDING_DATA);
        expect(result.ok).toBe(true);
      });

      it("test_AS_031_profiles_onboarded_at_is_non_null_after_confirming", async () => {
        const { data, error } = await admin
          .from("profiles")
          .select("onboarded_at, sex, birth_year, height_cm, weight_kg, activity_level")
          .eq("user_id", userId)
          .single();

        expect(error).toBeNull();
        expect(data?.onboarded_at).not.toBeNull();
        expect(data?.sex).toBe("female");
        expect(data?.height_cm).toBe(168);
        expect(data?.weight_kg).toBe(80);
        expect(data?.activity_level).toBe("sedentary");
      });

      it("test_AS_031_a_targets_row_exists_for_the_user_after_confirming", async () => {
        const { data, error } = await admin
          .from("targets")
          .select("daily_kcal, weekly_kcal, protein_g, fat_g, carbs_g, goal_weight_kg, timeframe_weeks")
          .eq("user_id", userId)
          .order("effective_from", { ascending: false })
          .limit(1)
          .single();

        expect(error).toBeNull();
        expect(data?.daily_kcal).toBeGreaterThan(0);
        expect(data?.weekly_kcal).toBe((data?.daily_kcal ?? 0) * 7);
        expect(data?.goal_weight_kg).toBe(76);
        expect(data?.timeframe_weeks).toBe(20);
      });

      it("test_AS_031_a_second_login_lands_past_onboarding_the_f013_gate_no_longer_redirects", async () => {
        // A brand-new cookie jar + fresh sign-in -- exactly what "a
        // returning user" (AS-031's own wording) looks like at the
        // middleware level, not a reuse of the same session.
        const returningJar = makeCookieJarClient();
        const { error: signInErr } = await returningJar.supabase.auth.signInWithPassword({
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const response = await middleware(
          makeRequest("/danas", returningJar.cookieHeader())
        );

        expect(response.headers.get("location")).toBeNull();
      });
    });

    describe("AS-020: editing a value before confirming changes the saved values", () => {
      it("test_AS_020_persisting_edited_inputs_saves_the_recomputed_edited_budget_not_the_original", async () => {
        const email = `f016-onboarding-edit-${suffix}@example.com`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        const editUserId = data.user!.id;
        createdUserIds.push(editUserId);

        const jar = makeCookieJarClient();
        await jar.supabase.auth.signInWithPassword({ email, password });

        // First save: the "original" hand-off values.
        const firstResult = await persistOnboarding(
          jar.supabase,
          editUserId,
          BASE_ONBOARDING_DATA
        );
        expect(firstResult.ok).toBe(true);

        const { data: firstTarget } = await admin
          .from("targets")
          .select("daily_kcal")
          .eq("user_id", editUserId)
          .order("effective_from", { ascending: false })
          .limit(1)
          .single();
        const firstDailyKcal = firstTarget?.daily_kcal;

        // User edits activity level (sedentary -> very_active) on the
        // summary screen before confirming again -- a materially different
        // TDEE, so the daily budget must change.
        const editedData: OnboardingData = {
          ...BASE_ONBOARDING_DATA,
          activityLevel: "very_active",
        };
        const secondResult = await persistOnboarding(
          jar.supabase,
          editUserId,
          editedData
        );
        expect(secondResult.ok).toBe(true);

        const { data: secondTarget, error: secondErr } = await admin
          .from("targets")
          .select("daily_kcal")
          .eq("user_id", editUserId)
          .order("effective_from", { ascending: false })
          .limit(1)
          .single();

        expect(secondErr).toBeNull();
        expect(secondTarget?.daily_kcal).not.toBe(firstDailyKcal);

        const { data: profile } = await admin
          .from("profiles")
          .select("activity_level")
          .eq("user_id", editUserId)
          .single();
        expect(profile?.activity_level).toBe("very_active");
      });
    });
  }
);

describe.skipIf(hasCredentials)(
  "F016: live onboarding-save integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_020_AS_031_blocked", () => {
      console.warn(
        "[F016] Live onboarding-save integration tests for AS-020/AS-031 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F016-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
