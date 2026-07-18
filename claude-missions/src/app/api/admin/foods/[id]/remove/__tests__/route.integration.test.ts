// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/admin/foods/[id]/remove/route";
import { lookupFoodByBarcode } from "@/lib/food/barcode";
import { searchFoods } from "@/lib/food/search";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import { uniqueTestBarcode } from "@/lib/test-utils/unique-barcode";
import type { Database, Food } from "@/lib/types/db";

// F034 / AS-063: live-project proof for `POST /api/admin/foods/[id]/remove`
// -- admin-only (401 signed-out, 403 non-admin), 404 unknown id, and a real
// 200 that soft-removes the food, after which it is excluded from BOTH
// search and barcode lookup while an existing log's snapshot survives.
// Mirrors the sibling `verify/__tests__/route.integration.test.ts`'s shape.

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", "..");

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

const hasCredentials = Boolean(
  SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_SECRET_KEY &&
    SUPABASE_ACCESS_TOKEN &&
    SUPABASE_PROJECT_REF
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

function makeRemoveRequest(id: string, cookieHeader: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/admin/foods/${encodeURIComponent(id)}/remove`,
    { method: "POST", headers: cookieHeader ? { cookie: cookieHeader } : {} }
  );
}

function makeParamsContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe.skipIf(!hasCredentials)(
  "F034 / AS-063: POST /api/admin/foods/[id]/remove on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F034-Remove-${suffix}!aA`;
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

    async function createSignedInUser(emailPrefix: string) {
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

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);
      return { userId: data.user.id, ...jar };
    }

    async function createSignedInAdmin(emailPrefix: string) {
      const user = await createSignedInUser(emailPrefix);
      await managementApiQuery(
        `update public.profiles set is_admin = true where user_id = '${user.userId}'`
      );
      return user;
    }

    async function insertUnverifiedFood(namePrefix: string, barcode?: string) {
      const { data, error } = await admin
        .from("foods")
        .insert({
          name_sr: `${namePrefix}-${suffix}`,
          kcal_100g: 300,
          protein_100g: 11,
          carbs_100g: 28,
          fat_100g: 12,
          common_units: [],
          source: "user",
          verified: false,
          barcode,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`Failed to seed test food: ${error?.message}`);
      }
      createdFoodIds.push(data.id);
      return data as Food;
    }

    it("test_a_signed_out_request_is_rejected_with_401", async () => {
      const food = await insertUnverifiedFood("f034-remove-signedout");

      const response = await POST(
        makeRemoveRequest(food.id, ""),
        makeParamsContext(food.id)
      );

      expect(response.status).toBe(401);

      const { data: unchanged } = await admin
        .from("foods")
        .select("is_removed")
        .eq("id", food.id)
        .single();
      expect(unchanged?.is_removed).toBe(false);
    });

    it("test_AS_060_a_non_admin_signed_in_request_is_rejected_with_403", async () => {
      const food = await insertUnverifiedFood("f034-remove-nonadmin");
      const user = await createSignedInUser("f034-remove-nonadmin");

      const response = await POST(
        makeRemoveRequest(food.id, user.cookieHeader()),
        makeParamsContext(food.id)
      );

      expect(response.status).toBe(403);

      const { data: unchanged } = await admin
        .from("foods")
        .select("is_removed")
        .eq("id", food.id)
        .single();
      expect(unchanged?.is_removed).toBe(false);
    });

    it("test_an_unknown_food_id_returns_404_for_an_admin", async () => {
      const adminUser = await createSignedInAdmin("f034-remove-404");

      const response = await POST(
        makeRemoveRequest(
          "00000000-0000-0000-0000-000000000000",
          adminUser.cookieHeader()
        ),
        makeParamsContext("00000000-0000-0000-0000-000000000000")
      );

      expect(response.status).toBe(404);
    });

    it("test_AS_063_an_admin_request_soft_removes_the_food_excludes_it_from_search_and_barcode_and_keeps_the_log_snapshot", async () => {
      const barcode = uniqueTestBarcode();
      const food = await insertUnverifiedFood(
        "F034RouteRemoveTargetNamirnica",
        barcode
      );
      const adminUser = await createSignedInAdmin("f034-remove-success");

      const { data: log, error: logErr } = await admin
        .from("logs")
        .insert({
          user_id: adminUser.userId,
          food_id: food.id,
          name: food.name_sr,
          grams: 100,
          kcal: 300,
          protein: 11,
          carbs: 28,
          fat: 12,
          method: "search",
        })
        .select("*")
        .single();
      expect(logErr).toBeNull();
      if (log) createdLogIds.push(log.id);

      const response = await POST(
        makeRemoveRequest(food.id, adminUser.cookieHeader()),
        makeParamsContext(food.id)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food };
      expect(body.ok).toBe(true);
      expect(body.data.is_removed).toBe(true);
      expect(body.data.removed_at).not.toBeNull();

      // AS-063: excluded from search.
      const searchResult = await searchFoods(
        adminUser.supabase,
        "F034RouteRemoveTargetNamirnica"
      );
      expect((searchResult.data ?? []).some((f) => f.id === food.id)).toBe(false);

      // AS-063: excluded from barcode lookup (an ordinary miss).
      const barcodeResult = await lookupFoodByBarcode(adminUser.supabase, barcode);
      expect(barcodeResult.data).toBeNull();

      // The log's snapshot is unaffected.
      const { data: persistedLog } = await admin
        .from("logs")
        .select("name, kcal, food_id")
        .eq("id", log!.id)
        .single();
      expect(persistedLog?.name).toBe(food.name_sr);
      expect(Number(persistedLog?.kcal)).toBe(300);
      expect(persistedLog?.food_id).toBe(food.id);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F034: live remove-route integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_063_blocked", () => {
      console.warn(
        "[F034] Live remove-route integration tests for AS-063 SKIPPED: " +
          "SUPABASE_*/SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF not all " +
          "resolvable from .env in this session."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
