// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { resolveAdminSessionForClient, toAdminApiResult } from "@/lib/auth/admin";
import { lookupFoodByBarcode } from "@/lib/food/barcode";
import { searchFoods } from "@/lib/food/search";
import {
  listUnverifiedFoods,
  removeFood,
  verifyFood,
} from "@/lib/food/admin-review";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import { uniqueTestBarcode } from "@/lib/test-utils/unique-barcode";
import type { Database } from "@/lib/types/db";

// F034 / AS-060 (the review queue lists verified=false foods, newest
// first, and denies a non-admin), AS-062 (verifying flips verified=true
// and the food leaves the queue), AS-063 (removing a food excludes it from
// BOTH search and barcode lookup, while an existing log referencing it
// keeps its snapshot) -- live-project proof against the real Supabase
// project. Same `describe.skipIf(!hasCredentials)` pattern established by
// every prior *.integration.test.ts in this repo.
//
// Per `missions/20260717-183157/connections/mcp-registry.md`, `mcp__
// supabase__*` tools are NOT bound inside worker subagents -- the
// `is_admin` flip for the admin test user uses the Supabase Management API
// SQL endpoint (`POST /v1/projects/{ref}/database/query`), exactly like
// F033's own `admin.integration.test.ts`.

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
  "F034: admin food review (AS-060, AS-062, AS-063) against the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F034-Test-${suffix}!aA`;
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
        await managementApiQuery(
          `update public.profiles set is_admin = false where user_id = '${id}'`
        ).catch(() => {});
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    async function createSubmitterUser(emailPrefix: string) {
      const email = `${emailPrefix}-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create test user: ${error?.message}`);
      }
      createdUserIds.push(data.user.id);
      return { userId: data.user.id, email };
    }

    async function createSignedInAdminUser() {
      const email = `f034-admin-${suffix}@example.com`;
      const { data, error } = await adminCreateUserRetry(admin, {
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create admin test user: ${error?.message}`);
      }
      const userId = data.user.id;
      createdUserIds.push(userId);
      await managementApiQuery(
        `update public.profiles set is_admin = true where user_id = '${userId}'`
      );

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Admin sign-in failed: ${signInErr.message}`);
      return { userId, ...jar };
    }

    async function insertUnverifiedFood(params: {
      namePrefix: string;
      submittedBy?: string | null;
      barcode?: string;
    }) {
      const { data, error } = await admin
        .from("foods")
        .insert({
          name_sr: `${params.namePrefix}-${suffix}`,
          kcal_100g: 220,
          protein_100g: 9,
          carbs_100g: 25,
          fat_100g: 7,
          common_units: [],
          source: "user",
          verified: false,
          submitted_by: params.submittedBy ?? null,
          barcode: params.barcode,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`Failed to seed test food: ${error?.message}`);
      }
      createdFoodIds.push(data.id);
      return data;
    }

    describe("AS-060: the review queue lists verified=false foods, newest first, and denies a non-admin", () => {
      it("test_AS_060_listUnverifiedFoods_returns_seeded_unverified_foods_with_submitter_email_newest_first", async () => {
        const submitter = await createSubmitterUser("f034-submitter");
        const older = await insertUnverifiedFood({
          namePrefix: "f034-older-unverified",
          submittedBy: submitter.userId,
        });
        // Small delay so `created_at` timestamps are unambiguously ordered
        // (Postgres `now()` has microsecond precision, but back-to-back
        // inserts within the same millisecond could otherwise tie).
        await new Promise((resolve) => setTimeout(resolve, 50));
        const newer = await insertUnverifiedFood({
          namePrefix: "f034-newer-unverified",
          submittedBy: submitter.userId,
        });

        const { data, error } = await listUnverifiedFoods(admin);
        expect(error).toBeNull();
        expect(data).not.toBeNull();

        const ids = (data ?? []).map((food) => food.id);
        expect(ids).toContain(older.id);
        expect(ids).toContain(newer.id);

        // Newest first: `newer`'s index in the list is before `older`'s.
        expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));

        const newerRow = (data ?? []).find((food) => food.id === newer.id);
        expect(newerRow?.submitterEmail).toBe(submitter.email);
        expect(newerRow?.verified).toBe(false);
      });

      it("test_AS_060_a_verified_food_and_a_removed_food_are_not_in_the_queue", async () => {
        const verifiedFood = await insertUnverifiedFood({
          namePrefix: "f034-already-verified",
        });
        await admin
          .from("foods")
          .update({ verified: true })
          .eq("id", verifiedFood.id);

        const removedFood = await insertUnverifiedFood({
          namePrefix: "f034-already-removed",
        });
        await admin
          .from("foods")
          .update({ is_removed: true, removed_at: new Date().toISOString() })
          .eq("id", removedFood.id);

        const { data, error } = await listUnverifiedFoods(admin);
        expect(error).toBeNull();
        const ids = (data ?? []).map((food) => food.id);
        expect(ids).not.toContain(verifiedFood.id);
        expect(ids).not.toContain(removedFood.id);
      });

      it("test_AS_060_a_non_admin_session_is_denied_by_the_same_gate_admin_hrana_depends_on", async () => {
        const { userId, email } = await createSubmitterUser("f034-nonadmin");
        void userId;
        const jar = makeCookieJarClient();
        const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
          email,
          password,
        });
        expect(signInErr).toBeNull();

        const session = await resolveAdminSessionForClient(jar.supabase);
        const apiResult = toAdminApiResult(session);

        expect(apiResult.ok).toBe(false);
        if (!apiResult.ok) {
          expect(apiResult.status).toBe(403);
        }
      });
    });

    describe("AS-062: verifying a food flips verified=true and it leaves the queue", () => {
      it("test_AS_062_verifyFood_flips_verified_true_and_the_food_no_longer_appears_in_listUnverifiedFoods", async () => {
        const food = await insertUnverifiedFood({ namePrefix: "f034-to-verify" });

        const beforeIds = ((await listUnverifiedFoods(admin)).data ?? []).map(
          (f) => f.id
        );
        expect(beforeIds).toContain(food.id);

        const result = await verifyFood(admin, food.id);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.verified).toBe(true);
        }

        const afterIds = ((await listUnverifiedFoods(admin)).data ?? []).map(
          (f) => f.id
        );
        expect(afterIds).not.toContain(food.id);

        // Side-effect verification: re-read via a FRESH admin query (not
        // just the mutation response) confirms the persisted state.
        const { data: persisted } = await admin
          .from("foods")
          .select("verified")
          .eq("id", food.id)
          .single();
        expect(persisted?.verified).toBe(true);
      });

      it("test_verifyFood_on_an_unknown_id_returns_a_not_found_result_never_throws", async () => {
        const result = await verifyFood(admin, "00000000-0000-0000-0000-000000000000");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(404);
          expect(result.error_sr.length).toBeGreaterThan(0);
        }
      });
    });

    describe("AS-063: removing a food excludes it from search AND barcode lookup, while an existing log keeps its snapshot", () => {
      it("test_AS_063_a_removed_food_is_excluded_from_both_search_and_barcode_lookup_and_an_existing_logs_snapshot_survives", async () => {
        const barcode = uniqueTestBarcode();
        const food = await insertUnverifiedFood({
          namePrefix: "F034RemoveTargetNamirnica",
          barcode,
        });

        const adminSession = await createSignedInAdminUser();

        // A log referencing this food, snapshotting its data at log time --
        // exactly the "money-math"/snapshot convention 0004_foods_logs.sql
        // established. Inserted directly via the admin client (this test
        // only cares that the SNAPSHOT survives removal, not the logging
        // flow itself, which F025/F026 already cover).
        const { data: log, error: logErr } = await admin
          .from("logs")
          .insert({
            user_id: adminSession.userId,
            food_id: food.id,
            name: food.name_sr,
            grams: 150,
            kcal: 330,
            protein: 13.5,
            carbs: 37.5,
            fat: 10.5,
            method: "search",
          })
          .select("*")
          .single();
        expect(logErr).toBeNull();
        if (log) createdLogIds.push(log.id);

        // Sanity: findable by both search and barcode lookup BEFORE removal.
        const beforeSearch = await searchFoods(
          adminSession.supabase,
          "F034RemoveTargetNamirnica"
        );
        expect((beforeSearch.data ?? []).some((f) => f.id === food.id)).toBe(true);

        const beforeBarcode = await lookupFoodByBarcode(
          adminSession.supabase,
          barcode
        );
        expect(beforeBarcode.data?.id).toBe(food.id);

        // Remove it.
        const removeResult = await removeFood(admin, food.id);
        expect(removeResult.ok).toBe(true);
        if (removeResult.ok) {
          expect(removeResult.data.is_removed).toBe(true);
          expect(removeResult.data.removed_at).not.toBeNull();
        }

        // AS-063: excluded from search.
        const afterSearch = await searchFoods(
          adminSession.supabase,
          "F034RemoveTargetNamirnica"
        );
        expect((afterSearch.data ?? []).some((f) => f.id === food.id)).toBe(false);

        // AS-063: excluded from barcode lookup (resolves as an ordinary miss).
        const afterBarcode = await lookupFoodByBarcode(
          adminSession.supabase,
          barcode
        );
        expect(afterBarcode.data).toBeNull();
        expect(afterBarcode.error).toBeNull();

        // The log's snapshot is completely untouched by the removal.
        const { data: persistedLog, error: persistedLogErr } = await admin
          .from("logs")
          .select("*")
          .eq("id", log!.id)
          .single();
        expect(persistedLogErr).toBeNull();
        expect(persistedLog?.name).toBe(food.name_sr);
        expect(Number(persistedLog?.kcal)).toBe(330);
        expect(Number(persistedLog?.protein)).toBe(13.5);
        expect(Number(persistedLog?.carbs)).toBe(37.5);
        expect(Number(persistedLog?.fat)).toBe(10.5);
        expect(persistedLog?.food_id).toBe(food.id);
      });

      it("test_removeFood_on_an_unknown_id_returns_a_not_found_result_never_throws", async () => {
        const result = await removeFood(admin, "00000000-0000-0000-0000-000000000000");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(404);
        }
      });

      it("test_removeFood_is_idempotent_a_second_removal_of_an_already_removed_food_is_a_not_found_not_a_crash", async () => {
        const food = await insertUnverifiedFood({ namePrefix: "f034-double-remove" });
        const first = await removeFood(admin, food.id);
        expect(first.ok).toBe(true);

        const second = await removeFood(admin, food.id);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          expect(second.status).toBe(404);
        }
      });
    });
  }
);

describe.skipIf(hasCredentials)(
  "F034: live admin food review integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_060_AS_062_AS_063_blocked", () => {
      console.warn(
        "[F034] Live admin food review integration tests SKIPPED: " +
          "SUPABASE_*/SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF not all " +
          "resolvable from .env in this session. See " +
          "missions/20260717-183157/handoffs/F034-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
