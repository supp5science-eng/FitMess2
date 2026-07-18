// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { GET } from "@/app/api/foods/recents/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Food } from "@/lib/types/db";

// F024 / AS-040: live-project proof that `GET /api/foods/recents` returns
// the SIGNED-IN user's own recently-logged foods, most-recent first, and
// that a different user's recents endpoint never leaks someone else's log
// history. Log CREATION (the grams/portion picker) is F025's job -- per the
// clarified spec, this test seeds `logs` rows directly (via the admin
// client, exactly like F020's own schema/RLS integration tests do) rather
// than building or exercising a portion-picker UI that doesn't exist yet.
//
// Follows the same `describe.skipIf(!hasCredentials)` cookie-jar pattern
// F023's `GET /api/foods/search` integration test established (see that
// file's header comment for the full rationale).

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
 * integration test in this repo uses -- see F023's search route test for
 * the full rationale. */
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

function makeRecentsRequest(cookieHeader: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/foods/recents", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe.skipIf(!hasCredentials)(
  "F024 / AS-040: GET /api/foods/recents on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F024-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];
    const createdLogIds: string[] = [];

    afterAll(async () => {
      for (const id of createdLogIds) {
        await admin.from("logs").delete().eq("id", id).then(() => {}, () => {});
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

    /** Two real, distinct foods from the live catalog to log against -- any
     * two rows work; this just needs stable ids to reference from `logs`. */
    async function fetchTwoCatalogFoods(): Promise<[Food, Food]> {
      const { data, error } = await admin
        .from("foods")
        .select("*")
        .limit(2)
        .order("name_sr", { ascending: true });
      if (error || !data || data.length < 2) {
        throw new Error(
          `Failed to fetch two catalog foods for the recents test: ${error?.message}`
        );
      }
      return [data[0], data[1]];
    }

    /** Seeds a `logs` row directly via the admin client (log CREATION via
     * the real UI is F025's scope, not this feature's -- see this file's
     * header comment) with a caller-controlled `logged_at` so recency
     * ordering can be asserted deterministically. */
    async function seedLog(
      userId: string,
      food: Food,
      loggedAt: string
    ): Promise<void> {
      const { data, error } = await admin
        .from("logs")
        .insert({
          user_id: userId,
          food_id: food.id,
          name: food.name_sr,
          grams: 100,
          kcal: food.kcal_100g,
          protein: food.protein_100g,
          carbs: food.carbs_100g,
          fat: food.fat_100g,
          logged_at: loggedAt,
          method: "search",
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to seed a log row: ${error?.message}`);
      }
      createdLogIds.push(data.id);
    }

    it("test_AS_040_a_user_who_has_logged_foods_sees_them_in_their_recents_list_most_recent_first", async () => {
      const [olderFood, newerFood] = await fetchTwoCatalogFoods();
      const user = await createSignedInUser("f024-recents-a");

      // Log the "older" food first, then the "newer" food later -- the
      // recents list must come back newest-logged first.
      await seedLog(user.userId, olderFood, "2026-01-01T08:00:00.000Z");
      await seedLog(user.userId, newerFood, "2026-01-05T08:00:00.000Z");

      const response = await GET(makeRecentsRequest(user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);

      const recentIds = body.data.map((f) => f.id);
      expect(recentIds).toContain(olderFood.id);
      expect(recentIds).toContain(newerFood.id);
      expect(recentIds.indexOf(newerFood.id)).toBeLessThan(
        recentIds.indexOf(olderFood.id)
      );
    });

    it("test_AS_040_re_logging_the_same_food_does_not_duplicate_it_in_recents", async () => {
      const [food] = await fetchTwoCatalogFoods();
      const user = await createSignedInUser("f024-recents-dedupe");

      await seedLog(user.userId, food, "2026-01-01T08:00:00.000Z");
      await seedLog(user.userId, food, "2026-01-02T08:00:00.000Z");

      const response = await GET(makeRecentsRequest(user.cookieHeader()));
      const body = (await response.json()) as { ok: boolean; data: Food[] };

      const occurrences = body.data.filter((f) => f.id === food.id).length;
      expect(occurrences).toBe(1);
    });

    it("test_AS_040_a_user_with_no_logs_has_an_empty_recents_list_not_an_error", async () => {
      const user = await createSignedInUser("f024-recents-empty");

      const response = await GET(makeRecentsRequest(user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("test_AS_040_user_bs_recents_never_include_user_as_logged_foods", async () => {
      const [food] = await fetchTwoCatalogFoods();
      const userA = await createSignedInUser("f024-recents-b-isolation-a");
      const userB = await createSignedInUser("f024-recents-b-isolation-b");

      await seedLog(userA.userId, food, "2026-01-01T08:00:00.000Z");

      const responseA = await GET(makeRecentsRequest(userA.cookieHeader()));
      const bodyA = (await responseA.json()) as { ok: boolean; data: Food[] };
      expect(bodyA.data.some((f) => f.id === food.id)).toBe(true);

      const responseB = await GET(makeRecentsRequest(userB.cookieHeader()));
      const bodyB = (await responseB.json()) as { ok: boolean; data: Food[] };
      expect(bodyB.ok).toBe(true);
      expect(bodyB.data).toEqual([]);
      expect(bodyB.data.some((f) => f.id === food.id)).toBe(false);
    });

    it("test_a_signed_out_request_is_rejected_with_401_and_no_data", async () => {
      const response = await GET(makeRecentsRequest(""));
      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      expect(JSON.stringify(body)).not.toMatch(/food/i);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F024: live recents integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_recents_unreachable_AS_040_blocked", () => {
      console.warn(
        "[F024] Live recents integration tests for AS-040 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F024-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
