// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { GET } from "@/app/api/foods/search/route";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Food } from "@/lib/types/db";

// F023 / AS-036 (Latin-script name search returns the matching food),
// AS-037 (Cyrillic input returns foods stored with Latin names), AS-038 (a
// one-character typo still returns the intended food) -- the live-project
// proof that `GET /api/foods/search?q=...` actually finds real rows in the
// live 1678-row `foods` catalog (350 seed sr-Latn + 1328 OFF, see the F021/
// F022 handoffs).
//
// Follows the exact same `describe.skipIf(!hasCredentials)` cookie-jar
// pattern established by F018's `GET /api/export` integration test (see
// `src/app/api/export/__tests__/route.integration.test.ts`'s header comment
// for the full rationale) -- builds a real signed-in session via
// `@supabase/ssr`'s in-memory cookie jar, then calls this route's `GET`
// directly with a hand-built `NextRequest` carrying those cookies, no
// running Next server required.

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

/** Same in-memory cookie-jar `createServerClient` shape F018/F020's live
 * integration tests use -- signing in through this client produces the same
 * cookie names + base64url-encoded values a real browser session would
 * carry, capturable for building `NextRequest`s. */
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

function makeSearchRequest(q: string, cookieHeader: string): NextRequest {
  const url = `http://localhost:3000/api/foods/search?q=${encodeURIComponent(q)}`;
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

let schemaReady = false;
let preflightError: unknown;

if (hasCredentials) {
  try {
    const admin = makeAdminClient();
    const rpcProbe = await admin.rpc("search_foods", {
      search_query: "plazma",
      result_limit: 1,
    });
    schemaReady = !rpcProbe.error;
    preflightError = rpcProbe.error;
  } catch (err) {
    schemaReady = false;
    preflightError = err;
  }
}

describe.skipIf(!hasCredentials || !schemaReady)(
  "F023 / AS-036, AS-037, AS-038: GET /api/foods/search on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F023-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
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

    it("test_AS_036_searching_a_known_latin_script_name_returns_the_matching_food", async () => {
      const user = await createSignedInUser("f023-latin");

      const response = await GET(makeSearchRequest("Plazma", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("plazma"))
      ).toBe(true);
    });

    it("test_AS_036_searching_sarma_in_latin_returns_a_sarma_food", async () => {
      const user = await createSignedInUser("f023-latin-sarma");

      const response = await GET(makeSearchRequest("sarma", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("sarma"))
      ).toBe(true);
    });

    it("test_AS_037_searching_the_same_term_in_cyrillic_returns_the_latin_stored_food", async () => {
      const user = await createSignedInUser("f023-cyr-plazma");

      // "Плазма" is the Cyrillic spelling of "Plazma" -- the food is stored
      // as sr-Latn ("Plazma keks", etc., see supabase/seed/foods.json), so
      // this only succeeds if the route transliterates before searching.
      const response = await GET(makeSearchRequest("Плазма", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("plazma"))
      ).toBe(true);
    });

    it("test_AS_037_searching_cyrillic_sarma_returns_the_latin_stored_sarma_food", async () => {
      const user = await createSignedInUser("f023-cyr-sarma");

      const response = await GET(makeSearchRequest("сарма", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("sarma"))
      ).toBe(true);
    });

    it("test_AS_038_a_one_character_typo_missing_letter_still_returns_the_intended_food", async () => {
      const user = await createSignedInUser("f023-typo-missing");

      // "plazm" is "Plazma" with the trailing 'a' missing.
      const response = await GET(makeSearchRequest("plazm", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("plazma"))
      ).toBe(true);
    });

    it("test_AS_038_a_one_character_typo_wrong_letter_still_returns_a_sarma_food", async () => {
      const user = await createSignedInUser("f023-typo-wrong");

      // "sara" is "sarma" with the 'm' dropped/substituted -- a real,
      // plausible one-character typo.
      const response = await GET(makeSearchRequest("sara", user.cookieHeader()));
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(
        body.data.some((f) => f.name_sr.toLowerCase().includes("sarma"))
      ).toBe(true);
    });

    it("test_verified_seed_rows_rank_before_unverified_rows_for_the_same_query", async () => {
      const user = await createSignedInUser("f023-ranking");

      const response = await GET(makeSearchRequest("jabuka", user.cookieHeader()));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      // Once an unverified row appears, no verified row may appear after it
      // (verified-first ranking, per the clarified scope).
      let sawUnverified = false;
      for (const food of body.data) {
        if (!food.verified) {
          sawUnverified = true;
        } else {
          expect(sawUnverified).toBe(false);
        }
      }
    });

    it("test_results_are_bounded_to_20_or_fewer", async () => {
      const user = await createSignedInUser("f023-bounded");

      // A broad, common substring likely to match many rows in a
      // 1678-row catalog.
      const response = await GET(makeSearchRequest("a", user.cookieHeader()));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(20);
    });

    it("test_a_query_with_no_matches_returns_200_with_an_empty_list_not_an_error", async () => {
      const user = await createSignedInUser("f023-empty");

      const response = await GET(
        makeSearchRequest(
          `zzzznonexistentfoodxyz${suffix}`,
          user.cookieHeader()
        )
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: Food[] };
      expect(body.ok).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("test_an_empty_query_string_is_rejected_with_400_and_a_serbian_error", async () => {
      const user = await createSignedInUser("f023-malformed");

      const response = await GET(makeSearchRequest("", user.cookieHeader()));
      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      expect(body.error_sr).not.toMatch(/error|exception|stack/i);
    });

    it("test_a_signed_out_request_is_rejected_with_401_and_no_data", async () => {
      const response = await GET(makeSearchRequest("Plazma", ""));
      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
      expect(JSON.stringify(body)).not.toMatch(/plazma/i);
    });
  }
);

describe.skipIf(hasCredentials && schemaReady)(
  "F023: live food-search integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_search_foods_unreachable_AS_036_AS_037_AS_038_blocked", () => {
      const reason = !hasCredentials
        ? "SUPABASE_* credentials not resolvable from .env in this session"
        : `public.search_foods() not reachable on the live project (migration 0005_food_search.sql not yet applied) -- preflight error: ${
            preflightError instanceof Error
              ? preflightError.message
              : JSON.stringify(preflightError)
          }`;
      console.warn(
        `[F023] Live food-search integration tests for AS-036/AS-037/AS-038 SKIPPED: ${reason}. ` +
          "See missions/20260717-183157/handoffs/F023-handoff.md Blockers for the follow-up needed. " +
          "This placeholder does not prove AS-036/AS-037/AS-038 -- it only documents why the real " +
          "assertions above did not run, without permanently red-ing this test file for unrelated " +
          "future workers."
      );
      expect(schemaReady).toBe(false);
    });
  }
);
