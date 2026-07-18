// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { getTodayData } from "@/lib/home/today";
import { getTodayRange } from "@/lib/home/today-range";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";

// F027 / AS-047, AS-048, AS-049, AS-050: live-project proof that
// `getTodayData` reads the SIGNED-IN user's own newest target row + today's
// logs (joined with their referenced foods), through the real RLS policies
// (`targets_select_own`, `logs_select_own`, `foods_select_all_
// authenticated`) -- never another user's rows. Follows the same
// `describe.skipIf(!hasCredentials)` cookie-jar pattern every other live
// integration test in this repo uses (see e.g.
// `src/app/api/logs/__tests__/route.integration.test.ts`'s header comment).

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

  return supabase;
}

describe.skipIf(!hasCredentials)(
  "F027 / AS-047, AS-048, AS-049, AS-050: getTodayData on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F027-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];
    const createdFoodIds: string[] = [];

    afterAll(async () => {
      for (const id of createdFoodIds) {
        await admin.from("foods").delete().eq("id", id).then(() => {}, () => {});
      }
      for (const id of createdUserIds) {
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    async function createSignedInUser(emailPrefix: string) {
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

      const supabase = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      return { userId, supabase };
    }

    async function createTestFood(namePrefix: string) {
      const { data, error } = await admin
        .from("foods")
        .insert({
          name_sr: `${namePrefix}-${suffix}`,
          kcal_100g: 200,
          protein_100g: 10,
          carbs_100g: 20,
          fat_100g: 5,
          common_units: [{ label: "parče", grams: 50 }],
          source: "user",
          verified: true,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create test food: ${error?.message}`);
      }
      createdFoodIds.push(data.id);
      return data;
    }

    it("test_AS_047_AS_048_returns_the_users_newest_target_row_when_multiple_exist", async () => {
      const user = await createSignedInUser("f027-target");

      await admin.from("targets").insert({
        user_id: user.userId,
        daily_kcal: 1800,
        protein_g: 120,
        fat_g: 50,
        carbs_g: 180,
        weekly_kcal: 12600,
        goal_weight_kg: 70,
        timeframe_weeks: 10,
        effective_from: "2026-01-01T00:00:00.000Z",
      });
      await admin.from("targets").insert({
        user_id: user.userId,
        daily_kcal: 2200,
        protein_g: 160,
        fat_g: 70,
        carbs_g: 220,
        weekly_kcal: 15400,
        goal_weight_kg: 68,
        timeframe_weeks: 8,
        effective_from: "2026-06-01T00:00:00.000Z",
      });

      const result = await getTodayData(user.supabase, user.userId);

      expect(result.error).toBeNull();
      expect(result.data?.target?.daily_kcal).toBe(2200);
    });

    it("test_AS_049_returns_only_todays_logs_with_their_food_attached_not_yesterdays", async () => {
      const user = await createSignedInUser("f027-logs");
      const food = await createTestFood("f027-meal-food");

      const range = getTodayRange();
      const todayLoggedAt = new Date(
        new Date(range.startIso).getTime() + 60 * 60 * 1000
      ).toISOString();
      const yesterdayLoggedAt = new Date(
        new Date(range.startIso).getTime() - 60 * 60 * 1000
      ).toISOString();

      const { data: todayLog } = await admin
        .from("logs")
        .insert({
          user_id: user.userId,
          food_id: food.id,
          name: food.name_sr,
          grams: 150,
          kcal: 300,
          protein: 15,
          carbs: 30,
          fat: 7.5,
          method: "search",
          logged_at: todayLoggedAt,
        })
        .select("id")
        .single();

      await admin.from("logs").insert({
        user_id: user.userId,
        food_id: food.id,
        name: food.name_sr,
        grams: 100,
        kcal: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
        method: "search",
        logged_at: yesterdayLoggedAt,
      });

      const result = await getTodayData(user.supabase, user.userId, range);

      expect(result.error).toBeNull();
      expect(result.data?.logs).toHaveLength(1);
      expect(result.data?.logs[0]?.id).toBe(todayLog?.id);
      expect(result.data?.logs[0]?.food?.name_sr).toBe(food.name_sr);
    });

    it("test_AS_050_multiple_todays_logs_sum_above_the_daily_target_are_all_returned_for_the_caller_to_detect_overshoot", async () => {
      const user = await createSignedInUser("f027-overshoot");
      const food = await createTestFood("f027-overshoot-food");

      await admin.from("targets").insert({
        user_id: user.userId,
        daily_kcal: 500,
        protein_g: 40,
        fat_g: 15,
        carbs_g: 50,
        weekly_kcal: 3500,
        goal_weight_kg: 70,
        timeframe_weeks: 10,
      });

      await admin.from("logs").insert([
        {
          user_id: user.userId,
          food_id: food.id,
          name: food.name_sr,
          grams: 300,
          kcal: 600,
          protein: 30,
          carbs: 60,
          fat: 15,
          method: "search",
        },
      ]);

      const result = await getTodayData(user.supabase, user.userId);

      expect(result.error).toBeNull();
      expect(result.data?.target?.daily_kcal).toBe(500);
      const consumedKcal = (result.data?.logs ?? []).reduce(
        (sum, log) => sum + log.kcal,
        0
      );
      expect(consumedKcal).toBeGreaterThan(result.data?.target?.daily_kcal ?? 0);
    });

    it("test_no_target_and_no_logs_yet_resolves_to_target_null_and_an_empty_logs_list_not_an_error", async () => {
      const user = await createSignedInUser("f027-empty");

      const result = await getTodayData(user.supabase, user.userId);

      expect(result.error).toBeNull();
      expect(result.data?.target).toBeNull();
      expect(result.data?.logs).toEqual([]);
    });

    it("test_a_users_own_getTodayData_call_never_returns_another_users_logs_or_targets", async () => {
      const userA = await createSignedInUser("f027-isolation-a");
      const userB = await createSignedInUser("f027-isolation-b");
      const food = await createTestFood("f027-isolation-food");

      await admin.from("targets").insert({
        user_id: userA.userId,
        daily_kcal: 1900,
        protein_g: 130,
        fat_g: 55,
        carbs_g: 190,
        weekly_kcal: 13300,
        goal_weight_kg: 70,
        timeframe_weeks: 10,
      });
      await admin.from("logs").insert({
        user_id: userA.userId,
        food_id: food.id,
        name: food.name_sr,
        grams: 100,
        kcal: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
        method: "search",
      });

      const resultB = await getTodayData(userB.supabase, userB.userId);

      expect(resultB.error).toBeNull();
      expect(resultB.data?.target).toBeNull();
      expect(resultB.data?.logs).toEqual([]);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F027: live getTodayData integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_getTodayData_unreachable_AS_047_AS_048_AS_049_AS_050_blocked", () => {
      console.warn(
        "[F027] Live getTodayData integration tests SKIPPED: SUPABASE_* " +
          "credentials not resolvable from .env in this session. See " +
          "missions/20260717-183157/handoffs/F027-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
