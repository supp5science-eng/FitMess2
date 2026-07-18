// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/logs/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Log } from "@/lib/types/db";

// F025 / AS-041 (log by grams, macros computed from per-100g values),
// AS-042 (log by a common unit uses the unit's gram weight x quantity) --
// live-project proof that `POST /api/logs` actually writes a `logs` row
// through the SIGNED-IN user's own session (RLS-governed, per the clarified
// access-control answer), with the correct computed + SNAPSHOTTED
// kcal/protein/carbs/fat, and never leaks/writes to another user's rows.
//
// Follows the same `describe.skipIf(!hasCredentials)` cookie-jar pattern
// established by F019/F023/F024's live integration tests (see those files'
// header comments for the full rationale).

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

/** Same in-memory cookie-jar `createServerClient` shape every other live
 * integration test in this repo uses. */
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

function makeLogsRequest(cookieHeader: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/logs", {
    method: "POST",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasCredentials)(
  "F025 / AS-041, AS-042: POST /api/logs on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F025-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];
    const createdFoodIds: string[] = [];
    const createdLogIds: string[] = [];

    afterAll(async () => {
      for (const id of createdLogIds) {
        await admin.from("logs").delete().eq("id", id).then(() => {}, () => {});
      }
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

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      return { userId, email, ...jar };
    }

    /** A deterministic test food this test fully controls (rather than
     * relying on live seed-catalog contents/shape), including a known
     * common unit for AS-042. */
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

    it("test_AS_041_logging_by_grams_computes_kcal_and_macros_from_per_100g_values_and_snapshots_them", async () => {
      const food = await createTestFood("f025-grams-food");
      const user = await createSignedInUser("f025-grams");

      const response = await POST(
        makeLogsRequest(user.cookieHeader(), { foodId: food.id, grams: 150 })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Log };
      expect(body.ok).toBe(true);
      createdLogIds.push(body.data.id);

      // 200 * 1.5 = 300 kcal; 10*1.5=15 protein; 20*1.5=30 carbs; 5*1.5=7.5 fat
      expect(body.data.grams).toBe(150);
      expect(body.data.kcal).toBe(300);
      expect(body.data.protein).toBe(15);
      expect(body.data.carbs).toBe(30);
      expect(body.data.fat).toBe(7.5);
      expect(body.data.method).toBe("search");
      expect(body.data.name).toBe(food.name_sr);

      // Persisted row (via the admin client) reflects the exact same
      // snapshot values -- not just the HTTP response.
      const { data: persisted, error: persistedErr } = await admin
        .from("logs")
        .select("*")
        .eq("id", body.data.id)
        .single();
      expect(persistedErr).toBeNull();
      expect(persisted?.user_id).toBe(user.userId);
      expect(persisted?.food_id).toBe(food.id);
      expect(persisted?.grams).toBe(150);
      expect(persisted?.kcal).toBe(300);
      expect(persisted?.protein).toBe(15);
      expect(persisted?.carbs).toBe(30);
      expect(persisted?.fat).toBe(7.5);
    });

    it("test_AS_042_logging_by_a_common_unit_uses_the_units_gram_weight_times_quantity", async () => {
      const food = await createTestFood("f025-unit-food");
      const user = await createSignedInUser("f025-unit");

      // The food's only common unit is {label:"parče", grams:50}; the UI
      // resolves "2 parčeta" to 100g (50 * 2) before this request is sent --
      // see `src/lib/food/portions.ts`'s `resolveUnitGrams`, unit-tested
      // separately in `src/lib/food/__tests__/portions.test.ts`.
      const unit = food.common_units[0];
      expect(unit).toEqual({ label: "parče", grams: 50 });
      const quantity = 2;
      const expectedGrams = unit.grams * quantity;

      const response = await POST(
        makeLogsRequest(user.cookieHeader(), {
          foodId: food.id,
          grams: expectedGrams,
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Log };
      expect(body.ok).toBe(true);
      createdLogIds.push(body.data.id);

      expect(body.data.grams).toBe(expectedGrams);
      expect(body.data.grams).toBe(100);
      // 200 kcal/100g * (100/100) = 200 kcal; 10*1=10 protein; 20*1=20 carbs; 5*1=5 fat
      expect(body.data.kcal).toBe(200);
      expect(body.data.protein).toBe(10);
      expect(body.data.carbs).toBe(20);
      expect(body.data.fat).toBe(5);
    });

    it("test_a_signed_out_request_is_rejected_with_401_and_creates_no_log", async () => {
      const food = await createTestFood("f025-signed-out-food");

      const response = await POST(
        makeLogsRequest("", { foodId: food.id, grams: 100 })
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);

      const { data: logsAfter } = await admin
        .from("logs")
        .select("id")
        .eq("food_id", food.id);
      expect(logsAfter ?? []).toEqual([]);
    });

    it("test_zero_or_negative_grams_is_rejected_with_400_and_creates_no_partial_write", async () => {
      const food = await createTestFood("f025-invalid-grams-food");
      const user = await createSignedInUser("f025-invalid-grams");

      const response = await POST(
        makeLogsRequest(user.cookieHeader(), { foodId: food.id, grams: 0 })
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      expect(body.error_sr).not.toMatch(/error|exception|stack/i);

      const { data: logsAfter } = await admin
        .from("logs")
        .select("id")
        .eq("user_id", user.userId);
      expect(logsAfter ?? []).toEqual([]);
    });

    it("test_a_nonexistent_food_id_is_rejected_with_404_and_creates_no_log", async () => {
      const user = await createSignedInUser("f025-missing-food");

      const response = await POST(
        makeLogsRequest(user.cookieHeader(), {
          foodId: "00000000-0000-0000-0000-000000000000",
          grams: 100,
        })
      );

      expect(response.status).toBe(404);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);

      const { data: logsAfter } = await admin
        .from("logs")
        .select("id")
        .eq("user_id", user.userId);
      expect(logsAfter ?? []).toEqual([]);
    });

    it("test_a_created_log_only_ever_belongs_to_the_creating_user_no_cross_user_leakage", async () => {
      const food = await createTestFood("f025-isolation-food");
      const userA = await createSignedInUser("f025-isolation-a");
      const userB = await createSignedInUser("f025-isolation-b");

      const response = await POST(
        makeLogsRequest(userA.cookieHeader(), { foodId: food.id, grams: 80 })
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Log };
      createdLogIds.push(body.data.id);
      expect(body.data.user_id).toBe(userA.userId);

      // User B's own session can never see user A's newly-created log row --
      // `logs_select_own` RLS enforces this, not application code.
      const { data: bVisible } = await userB.supabase
        .from("logs")
        .select("id")
        .eq("id", body.data.id);
      expect(bVisible ?? []).toEqual([]);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F025: live logs-create integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_logs_unreachable_AS_041_AS_042_blocked", () => {
      console.warn(
        "[F025] Live POST /api/logs integration tests for AS-041/AS-042 " +
          "SKIPPED: SUPABASE_* credentials not resolvable from .env in this " +
          "session. See missions/20260717-183157/handoffs/F025-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
