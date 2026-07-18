// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { DELETE, PATCH } from "@/app/api/logs/[id]/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Log } from "@/lib/types/db";

// F026 / AS-044 (editing a log entry's portion recalculates kcal/macros from
// the new portion and persists it), AS-045 (deleting a log entry removes
// it) -- live-project proof that `PATCH`/`DELETE /api/logs/[id]` actually
// mutate a `logs` row through the SIGNED-IN user's own session (RLS-
// governed, per the clarified access-control answer), and that neither
// handler ever lets one user edit or delete another user's row.
//
// Follows the same `describe.skipIf(!hasCredentials)` cookie-jar pattern
// established by F019/F023/F024/F025's live integration tests (see those
// files' header comments for the full rationale).

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

function makeLogRequest(
  method: "PATCH" | "DELETE",
  logId: string,
  cookieHeader: string,
  body?: unknown
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/logs/${logId}`, {
    method,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function makeParamsContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe.skipIf(!hasCredentials)(
  "F026 / AS-044, AS-045: PATCH/DELETE /api/logs/[id] on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F026-Test-${suffix}!aA`;
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

    /** A deterministic test food this test fully controls, including a
     * known common unit (used to prove edit recomputes from LIVE per-100g
     * values, not a stale snapshot). */
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

    /** Creates a log row DIRECTLY via the admin client (bypassing the
     * create route entirely -- this file only tests edit/delete) so each
     * test starts from a known, controlled log row. */
    async function createTestLog(params: {
      userId: string;
      foodId: string;
      name: string;
      grams: number;
    }) {
      const { data, error } = await admin
        .from("logs")
        .insert({
          user_id: params.userId,
          food_id: params.foodId,
          name: params.name,
          grams: params.grams,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          method: "search",
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create test log: ${error?.message}`);
      }
      createdLogIds.push(data.id);
      return data as Log;
    }

    it("test_AS_044_editing_a_logs_portion_recalculates_kcal_and_macros_from_the_new_grams_and_persists_them", async () => {
      const food = await createTestFood("f026-edit-food");
      const user = await createSignedInUser("f026-edit");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await PATCH(
        makeLogRequest("PATCH", log.id, user.cookieHeader(), { grams: 150 }),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Log };
      expect(body.ok).toBe(true);

      // 200 * 1.5 = 300 kcal; 10*1.5=15 protein; 20*1.5=30 carbs; 5*1.5=7.5 fat
      expect(body.data.grams).toBe(150);
      expect(body.data.kcal).toBe(300);
      expect(body.data.protein).toBe(15);
      expect(body.data.carbs).toBe(30);
      expect(body.data.fat).toBe(7.5);

      // Persisted row (via the admin client) reflects the exact same
      // recalculated snapshot values -- not just the HTTP response.
      const { data: persisted, error: persistedErr } = await admin
        .from("logs")
        .select("*")
        .eq("id", log.id)
        .single();
      expect(persistedErr).toBeNull();
      expect(persisted?.grams).toBe(150);
      expect(persisted?.kcal).toBe(300);
      expect(persisted?.protein).toBe(15);
      expect(persisted?.carbs).toBe(30);
      expect(persisted?.fat).toBe(7.5);
    });

    it("test_AS_044_editing_via_a_common_unit_selection_resolves_the_units_gram_weight_times_quantity", async () => {
      const food = await createTestFood("f026-edit-unit-food");
      const user = await createSignedInUser("f026-edit-unit");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 50,
      });

      // The food's only common unit is {label:"parče", grams:50}; the edit
      // sheet resolves "2 parčeta" to 100g before sending this request --
      // see src/lib/food/portions.ts's resolveUnitGrams (unit-tested
      // separately) -- this route only ever receives the final grams number.
      const response = await PATCH(
        makeLogRequest("PATCH", log.id, user.cookieHeader(), { grams: 100 }),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Log };
      expect(body.data.grams).toBe(100);
      expect(body.data.kcal).toBe(200);
      expect(body.data.protein).toBe(10);
      expect(body.data.carbs).toBe(20);
      expect(body.data.fat).toBe(5);
    });

    it("test_AS_045_deleting_a_log_entry_removes_it_from_the_database", async () => {
      const food = await createTestFood("f026-delete-food");
      const user = await createSignedInUser("f026-delete");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 80,
      });

      const response = await DELETE(
        makeLogRequest("DELETE", log.id, user.cookieHeader()),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      const { data: persisted } = await admin
        .from("logs")
        .select("id")
        .eq("id", log.id)
        .maybeSingle();
      expect(persisted).toBeNull();
      // Row is gone entirely -- confirms the day's totals would drop by
      // this entry's kcal/macros the next time they're recomputed (the
      // visual ring recompute itself is F027's job).
    });

    it("test_a_signed_out_PATCH_request_is_rejected_with_401_and_leaves_the_row_unchanged", async () => {
      const food = await createTestFood("f026-signed-out-patch-food");
      const user = await createSignedInUser("f026-signed-out-patch-owner");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await PATCH(
        makeLogRequest("PATCH", log.id, "", { grams: 200 }),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);

      const { data: persisted } = await admin
        .from("logs")
        .select("grams")
        .eq("id", log.id)
        .single();
      expect(persisted?.grams).toBe(100);
    });

    it("test_a_signed_out_DELETE_request_is_rejected_with_401_and_the_row_still_exists", async () => {
      const food = await createTestFood("f026-signed-out-delete-food");
      const user = await createSignedInUser("f026-signed-out-delete-owner");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await DELETE(
        makeLogRequest("DELETE", log.id, ""),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(401);

      const { data: persisted } = await admin
        .from("logs")
        .select("id")
        .eq("id", log.id)
        .maybeSingle();
      expect(persisted).not.toBeNull();
    });

    it("test_zero_or_negative_grams_on_edit_is_rejected_with_400_and_the_row_is_unchanged", async () => {
      const food = await createTestFood("f026-invalid-grams-food");
      const user = await createSignedInUser("f026-invalid-grams");
      const log = await createTestLog({
        userId: user.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await PATCH(
        makeLogRequest("PATCH", log.id, user.cookieHeader(), { grams: 0 }),
        makeParamsContext(log.id)
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);

      const { data: persisted } = await admin
        .from("logs")
        .select("grams")
        .eq("id", log.id)
        .single();
      expect(persisted?.grams).toBe(100);
    });

    it("test_editing_a_nonexistent_log_id_is_rejected_with_404", async () => {
      const user = await createSignedInUser("f026-missing-log-edit");

      const response = await PATCH(
        makeLogRequest(
          "PATCH",
          "00000000-0000-0000-0000-000000000000",
          user.cookieHeader(),
          { grams: 100 }
        ),
        makeParamsContext("00000000-0000-0000-0000-000000000000")
      );

      expect(response.status).toBe(404);
    });

    it("test_deleting_a_nonexistent_log_id_is_rejected_with_404", async () => {
      const user = await createSignedInUser("f026-missing-log-delete");

      const response = await DELETE(
        makeLogRequest(
          "DELETE",
          "00000000-0000-0000-0000-000000000000",
          user.cookieHeader()
        ),
        makeParamsContext("00000000-0000-0000-0000-000000000000")
      );

      expect(response.status).toBe(404);
    });

    it("test_a_user_cannot_edit_another_users_log_entry_denied_and_the_row_is_unchanged", async () => {
      const food = await createTestFood("f026-cross-user-edit-food");
      const owner = await createSignedInUser("f026-cross-user-edit-owner");
      const attacker = await createSignedInUser("f026-cross-user-edit-attacker");
      const log = await createTestLog({
        userId: owner.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await PATCH(
        makeLogRequest("PATCH", log.id, attacker.cookieHeader(), {
          grams: 999,
        }),
        makeParamsContext(log.id)
      );

      // RLS silently filters the row out for the non-owning session --
      // this route reports it as "not found/denied" (404), never revealing
      // that the row exists for someone else.
      expect([403, 404]).toContain(response.status);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);

      const { data: persisted } = await admin
        .from("logs")
        .select("grams")
        .eq("id", log.id)
        .single();
      expect(persisted?.grams).toBe(100);
    });

    it("test_a_user_cannot_delete_another_users_log_entry_denied_and_the_row_still_exists", async () => {
      const food = await createTestFood("f026-cross-user-delete-food");
      const owner = await createSignedInUser("f026-cross-user-delete-owner");
      const attacker = await createSignedInUser(
        "f026-cross-user-delete-attacker"
      );
      const log = await createTestLog({
        userId: owner.userId,
        foodId: food.id,
        name: food.name_sr,
        grams: 100,
      });

      const response = await DELETE(
        makeLogRequest("DELETE", log.id, attacker.cookieHeader()),
        makeParamsContext(log.id)
      );

      expect([403, 404]).toContain(response.status);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);

      const { data: persisted } = await admin
        .from("logs")
        .select("id")
        .eq("id", log.id)
        .maybeSingle();
      expect(persisted).not.toBeNull();
    });
  }
);

describe.skipIf(hasCredentials)(
  "F026: live logs edit/delete integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_logs_edit_delete_unreachable_AS_044_AS_045_blocked", () => {
      console.warn(
        "[F026] Live PATCH/DELETE /api/logs/[id] integration tests for " +
          "AS-044/AS-045 SKIPPED: SUPABASE_* credentials not resolvable " +
          "from .env in this session. See " +
          "missions/20260717-183157/handoffs/F026-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
