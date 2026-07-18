// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/foods/route";
import { GET as getFoodByBarcode } from "@/app/api/foods/barcode/[gtin]/route";
import { GET as searchFoods } from "@/app/api/foods/search/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import { uniqueTestBarcode } from "@/lib/test-utils/unique-barcode";
import type { Database, Food } from "@/lib/types/db";

// F032 / AS-055 (covered at the component/page level, see
// `src/components/food/__tests__/new-product-form.test.tsx` +
// `src/app/(app)/dodaj/novi-proizvod/__tests__/page.test.tsx`), AS-056 (a
// product saved by one user is IMMEDIATELY findable by ANY OTHER user via
// BOTH barcode scan and text search, marked source='user'/verified=false),
// AS-057 (inserting a second food with an already-used barcode is
// rejected with a friendly Serbian error, no crash, no duplicate row) --
// the live-project proof of `POST /api/foods`'s actual database behaviour.
//
// Follows the exact `describe.skipIf(!hasCredentials)` cookie-jar pattern
// established by F023/F025/F031's own live integration tests (see those
// files' header comments for the full rationale).

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

function makeCreateFoodRequest(
  cookieHeader: string,
  body: unknown
): NextRequest {
  return new NextRequest("http://localhost:3000/api/foods", {
    method: "POST",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeBarcodeRequest(gtin: string, cookieHeader: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/foods/barcode/${encodeURIComponent(gtin)}`,
    { headers: cookieHeader ? { cookie: cookieHeader } : {} }
  );
}

function makeBarcodeParamsContext(gtin: string) {
  return { params: Promise.resolve({ gtin }) };
}

function makeSearchRequest(q: string, cookieHeader: string): NextRequest {
  const url = `http://localhost:3000/api/foods/search?q=${encodeURIComponent(q)}`;
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe.skipIf(!hasCredentials)(
  "F032 / AS-055, AS-056, AS-057: POST /api/foods on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F032-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];
    const createdFoodIds: string[] = [];

    afterAll(async () => {
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

    function validEntryBody(overrides: Record<string, unknown> = {}) {
      return {
        name_sr: `F032 Test Proizvod ${suffix}`,
        brand: "F032 Test Brend",
        kcal_100g: 250,
        protein_100g: 12,
        carbs_100g: 30,
        fat_100g: 8,
        ...overrides,
      };
    }

    it("test_AS_056_a_product_saved_by_one_user_is_source_user_and_verified_false_and_attributed_to_the_submitter", async () => {
      const gtin = uniqueTestBarcode();
      const userA = await createSignedInUser("f032-a-attrib");

      const response = await POST(
        makeCreateFoodRequest(
          userA.cookieHeader(),
          validEntryBody({
            name_sr: `F032 Attrib Test ${suffix}`,
            barcode: gtin,
          })
        )
      );

      expect(response.status).toBe(201);
      const body = (await response.json()) as { ok: boolean; data: Food };
      expect(body.ok).toBe(true);
      createdFoodIds.push(body.data.id);

      expect(body.data.source).toBe("user");
      expect(body.data.verified).toBe(false);
      expect(body.data.submitted_by).toBe(userA.userId);
      expect(body.data.barcode).toBe(gtin);
    });

    it("test_AS_056_a_product_saved_by_user_a_is_immediately_findable_by_user_b_via_barcode_lookup_and_text_search", async () => {
      const gtin = uniqueTestBarcode();
      const distinctiveName = `F032 Findable Proizvod ${suffix}`;
      const userA = await createSignedInUser("f032-a-findable");
      const userB = await createSignedInUser("f032-b-findable");

      const createResponse = await POST(
        makeCreateFoodRequest(
          userA.cookieHeader(),
          validEntryBody({ name_sr: distinctiveName, barcode: gtin })
        )
      );
      expect(createResponse.status).toBe(201);
      const createBody = (await createResponse.json()) as {
        ok: boolean;
        data: Food;
      };
      expect(createBody.ok).toBe(true);
      createdFoodIds.push(createBody.data.id);

      // Findable by barcode scan (F031), as a DIFFERENT signed-in user.
      const barcodeResponse = await getFoodByBarcode(
        makeBarcodeRequest(gtin, userB.cookieHeader()),
        makeBarcodeParamsContext(gtin)
      );
      expect(barcodeResponse.status).toBe(200);
      const barcodeBody = (await barcodeResponse.json()) as {
        ok: boolean;
        data: Food | null;
      };
      expect(barcodeBody.ok).toBe(true);
      expect(barcodeBody.data?.id).toBe(createBody.data.id);
      expect(barcodeBody.data?.verified).toBe(false);
      expect(barcodeBody.data?.source).toBe("user");
      expect(barcodeBody.data?.submitted_by).toBe(userA.userId);

      // Findable by text search (F023), as the SAME different signed-in user.
      const searchResponse = await searchFoods(
        makeSearchRequest(distinctiveName, userB.cookieHeader())
      );
      expect(searchResponse.status).toBe(200);
      const searchBody = (await searchResponse.json()) as {
        ok: boolean;
        data: Food[];
      };
      expect(searchBody.ok).toBe(true);
      const found = searchBody.data.find((f) => f.id === createBody.data.id);
      expect(found).toBeDefined();
      expect(found?.verified).toBe(false);
      expect(found?.source).toBe("user");
      expect(found?.submitted_by).toBe(userA.userId);
    });

    it("test_AS_057_a_second_product_with_an_already_used_barcode_is_rejected_with_a_serbian_error_no_crash", async () => {
      const gtin = uniqueTestBarcode();
      const userA = await createSignedInUser("f032-dup-a");
      const userB = await createSignedInUser("f032-dup-b");

      const firstResponse = await POST(
        makeCreateFoodRequest(
          userA.cookieHeader(),
          validEntryBody({
            name_sr: `F032 Original Proizvod ${suffix}`,
            barcode: gtin,
          })
        )
      );
      expect(firstResponse.status).toBe(201);
      const firstBody = (await firstResponse.json()) as {
        ok: boolean;
        data: Food;
      };
      expect(firstBody.ok).toBe(true);
      createdFoodIds.push(firstBody.data.id);

      // A second, different user tries to submit a DIFFERENT product with
      // the SAME barcode -- must be rejected, not crash, and never create a
      // duplicate row.
      const duplicateResponse = await POST(
        makeCreateFoodRequest(
          userB.cookieHeader(),
          validEntryBody({
            name_sr: `F032 Duplicate Proizvod ${suffix}`,
            barcode: gtin,
          })
        )
      );

      expect(duplicateResponse.status).toBe(409);
      const duplicateBody = (await duplicateResponse.json()) as {
        ok: boolean;
        error_sr: string;
        existingFoodId?: string;
      };
      expect(duplicateBody.ok).toBe(false);
      expect(duplicateBody.error_sr.length).toBeGreaterThan(0);
      // Friendly Serbian message, not a raw technical/Postgres error.
      expect(duplicateBody.error_sr).not.toMatch(
        /duplicate key|constraint|23505|error|exception|stack/i
      );
      expect(duplicateBody.existingFoodId).toBe(firstBody.data.id);

      // Side-effect verification: exactly ONE row with this barcode exists
      // -- no duplicate was created.
      const { data: rowsWithBarcode, error: rowsError } = await admin
        .from("foods")
        .select("id, name_sr")
        .eq("barcode", gtin);
      expect(rowsError).toBeNull();
      expect(rowsWithBarcode).toHaveLength(1);
      expect(rowsWithBarcode?.[0]?.id).toBe(firstBody.data.id);
    });

    it("test_a_missing_name_is_rejected_with_400_and_a_serbian_error_no_row_created", async () => {
      const userA = await createSignedInUser("f032-missing-name");

      const response = await POST(
        makeCreateFoodRequest(
          userA.cookieHeader(),
          validEntryBody({ name_sr: "" })
        )
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
    });

    it("test_an_insane_kcal_value_is_rejected_with_400_and_a_serbian_error", async () => {
      const userA = await createSignedInUser("f032-insane-kcal");

      const response = await POST(
        makeCreateFoodRequest(
          userA.cookieHeader(),
          validEntryBody({
            name_sr: `F032 Insane Kcal ${suffix}`,
            kcal_100g: 5000,
          })
        )
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
    });

    it("test_a_signed_out_create_attempt_is_rejected_with_401_and_creates_no_row", async () => {
      const response = await POST(
        makeCreateFoodRequest("", validEntryBody({ name_sr: `F032 Signed Out ${suffix}` }))
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
    });
  }
);
