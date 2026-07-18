// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { GET } from "@/app/api/foods/barcode/[gtin]/route";
import { POST } from "@/app/api/logs/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Food, Log } from "@/lib/types/db";

// F031 / AS-053 (scanning/looking up a barcode that EXISTS returns that
// food and opens the portion picker), AS-054 (confirming a portion after a
// scan creates a log row with method='barcode' and correct computed
// macros) -- live-project proof of the full scan -> lookup -> portion ->
// log flow's server-side half:
//   1. `GET /api/foods/barcode/[gtin]` (this feature) actually finds a real
//      `foods` row by its unique `barcode` column, as the SIGNED-IN user's
//      own session (RLS-governed, per the clarified access-control
//      answer) -- AS-053.
//   2. `POST /api/logs` (F025, reused unmodified -- see that feature's
//      "REUSE NOTE" in `src/lib/food/portions.ts`), called with the found
//      food's id and `method: "barcode"`, persists a `logs` row snapshotting
//      the correct computed kcal/macros AND `method === "barcode"` -- AS-054.
// The client-side wiring between these two calls (`ScanScreen`) is covered
// separately by `src/components/scan/__tests__/scan-screen.test.tsx`.
//
// Follows the exact `describe.skipIf(!hasCredentials)` cookie-jar pattern
// established by F023/F025/F026's own live integration tests (see those
// files' header comments for the full rationale).

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..");

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

function makeBarcodeRequest(gtin: string, cookieHeader: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/foods/barcode/${encodeURIComponent(gtin)}`,
    { headers: cookieHeader ? { cookie: cookieHeader } : {} }
  );
}

function makeParamsContext(gtin: string) {
  return { params: Promise.resolve({ gtin }) };
}

function makeLogsPostRequest(
  cookieHeader: string,
  body: unknown
): NextRequest {
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
  "F031 / AS-053, AS-054: GET /api/foods/barcode/[gtin] + POST /api/logs (method='barcode') on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F031-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];
    const createdFoodIds: string[] = [];
    const createdLogIds: string[] = [];

    afterAll(async () => {
      for (const id of createdLogIds) {
        await admin
          .from("logs")
          .delete()
          .eq("id", id)
          .then(
            () => {},
            () => {}
          );
      }
      for (const id of createdFoodIds) {
        await admin
          .from("foods")
          .delete()
          .eq("id", id)
          .then(
            () => {},
            () => {}
          );
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
        throw new Error(
          `Failed to create confirmed test user: ${error?.message}`
        );
      }
      const userId = data.user.id;
      createdUserIds.push(userId);

      const jar = makeCookieJarClient();
      const { error: signInErr } = await signInWithPasswordRetry(
        jar.supabase,
        { email, password }
      );
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      return { userId, email, ...jar };
    }

    /** A deterministic test food with a known, unique barcode this test
     * fully controls. */
    async function createTestFoodWithBarcode(
      namePrefix: string,
      barcode: string
    ): Promise<Food> {
      const { data, error } = await admin
        .from("foods")
        .insert({
          name_sr: `${namePrefix}-${suffix}`,
          kcal_100g: 250,
          protein_100g: 12,
          carbs_100g: 30,
          fat_100g: 8,
          common_units: [],
          source: "user",
          verified: false,
          barcode,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create test food: ${error?.message}`);
      }
      createdFoodIds.push(data.id);
      return data;
    }

    /** A fresh, unique 13-digit GTIN per call -- always prefixed `9` (real
     * seed/OFF-imported EAN-13s in this catalog do not use this prefix
     * range for test-generated codes) plus 12 random digits, so each call
     * -- including different calls within the same test run -- gets its
     * own barcode and never collides with `foods.barcode`'s unique
     * constraint or a real product. `salt` only makes call sites
     * self-documenting; the actual uniqueness comes from `Math.random()`. */
    function makeTestGtin(salt: number): string {
      void salt;
      const random12Digits = Math.floor(Math.random() * 1_000_000_000_000)
        .toString()
        .padStart(12, "0");
      return `9${random12Digits}`;
    }

    it("test_AS_053_looking_up_a_barcode_that_exists_returns_that_food", async () => {
      const gtin = makeTestGtin(1);
      const food = await createTestFoodWithBarcode("f031-hit", gtin);
      const user = await createSignedInUser("f031-hit");

      const response = await GET(
        makeBarcodeRequest(gtin, user.cookieHeader()),
        makeParamsContext(gtin)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food | null };
      expect(body.ok).toBe(true);
      expect(body.data).not.toBeNull();
      expect(body.data?.id).toBe(food.id);
      expect(body.data?.barcode).toBe(gtin);
      expect(body.data?.name_sr).toBe(food.name_sr);
    });

    it("test_AS_053_looking_up_a_barcode_that_does_not_exist_returns_null_with_200_not_an_error", async () => {
      const gtin = makeTestGtin(2);
      const user = await createSignedInUser("f031-miss");

      const response = await GET(
        makeBarcodeRequest(gtin, user.cookieHeader()),
        makeParamsContext(gtin)
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food | null };
      expect(body.ok).toBe(true);
      expect(body.data).toBeNull();
    });

    it("test_a_malformed_gtin_is_rejected_with_400_and_a_serbian_error", async () => {
      const user = await createSignedInUser("f031-malformed");

      const response = await GET(
        makeBarcodeRequest("not-a-barcode", user.cookieHeader()),
        makeParamsContext("not-a-barcode")
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
    });

    it("test_a_signed_out_lookup_is_rejected_with_401_and_no_data", async () => {
      const gtin = makeTestGtin(3);
      const response = await GET(
        makeBarcodeRequest(gtin, ""),
        makeParamsContext(gtin)
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
    });

    it("test_AS_054_confirming_a_portion_after_a_scan_creates_a_log_with_method_barcode_and_correct_macros", async () => {
      const gtin = makeTestGtin(4);
      const food = await createTestFoodWithBarcode("f031-log", gtin);
      const user = await createSignedInUser("f031-log");

      // Step 1: the scan lookup (exactly what ScanScreen calls after
      // BarcodeScanner emits the GTIN).
      const lookupResponse = await GET(
        makeBarcodeRequest(gtin, user.cookieHeader()),
        makeParamsContext(gtin)
      );
      const lookupBody = (await lookupResponse.json()) as {
        ok: boolean;
        data: Food;
      };
      expect(lookupBody.data.id).toBe(food.id);

      // Step 2: confirming a 200g portion in the (reused, unmodified) F025
      // portion picker -- POSTs to /api/logs with method: "barcode".
      const logResponse = await POST(
        makeLogsPostRequest(user.cookieHeader(), {
          foodId: lookupBody.data.id,
          grams: 200,
          method: "barcode",
        })
      );

      expect(logResponse.status).toBe(200);
      const logBody = (await logResponse.json()) as { ok: boolean; data: Log };
      expect(logBody.ok).toBe(true);
      createdLogIds.push(logBody.data.id);

      // 250 kcal/100g * 2 = 500; 12*2=24 protein; 30*2=60 carbs; 8*2=16 fat.
      expect(logBody.data.method).toBe("barcode");
      expect(logBody.data.grams).toBe(200);
      expect(logBody.data.kcal).toBe(500);
      expect(logBody.data.protein).toBe(24);
      expect(logBody.data.carbs).toBe(60);
      expect(logBody.data.fat).toBe(16);

      // Side-effect verification: the PERSISTED row (via the admin client,
      // not just the HTTP response) reflects the same method + macros, and
      // this is the ONLY log row created for this user.
      const { data: persistedLogs, error: persistedErr } = await admin
        .from("logs")
        .select("*")
        .eq("user_id", user.userId);
      expect(persistedErr).toBeNull();
      expect(persistedLogs).toHaveLength(1);
      expect(persistedLogs?.[0]?.method).toBe("barcode");
      expect(persistedLogs?.[0]?.kcal).toBe(500);
      expect(persistedLogs?.[0]?.food_id).toBe(food.id);
    });

    it("test_AS_054_side_effect_no_cross_user_leakage_a_second_users_barcode_scan_never_touches_the_first_users_log", async () => {
      const gtinA = makeTestGtin(5);
      const foodA = await createTestFoodWithBarcode("f031-userA", gtinA);
      const userA = await createSignedInUser("f031-userA");
      const userB = await createSignedInUser("f031-userB");

      const logResponse = await POST(
        makeLogsPostRequest(userA.cookieHeader(), {
          foodId: foodA.id,
          grams: 100,
          method: "barcode",
        })
      );
      const logBody = (await logResponse.json()) as { ok: boolean; data: Log };
      expect(logBody.ok).toBe(true);
      createdLogIds.push(logBody.data.id);

      const { data: userBLogs } = await admin
        .from("logs")
        .select("*")
        .eq("user_id", userB.userId);
      expect(userBLogs).toHaveLength(0);

      const { data: userALogs } = await admin
        .from("logs")
        .select("*")
        .eq("user_id", userA.userId);
      expect(userALogs).toHaveLength(1);
      expect(userALogs?.[0]?.method).toBe("barcode");
    });
  }
);
