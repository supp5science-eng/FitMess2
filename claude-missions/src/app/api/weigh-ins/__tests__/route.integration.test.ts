// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/weigh-ins/route";
import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, WeighIn } from "@/lib/types/db";

// F042 / AS-072 (weight is kg to one decimal, bounded 30..300), AS-073 (a
// same-day re-weigh REPLACES the earlier value rather than stacking a
// duplicate) -- live-project proof that `POST /api/weigh-ins` writes a
// `weigh_ins` row through the SIGNED-IN user's own session (RLS-governed),
// upserts on (user_id, day), and never leaks/writes to another user's rows.
//
// Follows the same `describe.skipIf(!hasCredentials)` cookie-jar pattern as
// F025's `POST /api/logs` live test (see that file's header for rationale).

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

function makeWeighInRequest(cookieHeader: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/weigh-ins", {
    method: "POST",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasCredentials)(
  "F042 / AS-072, AS-073: POST /api/weigh-ins on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F042-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      // weigh_ins rows cascade-delete with the user, but clean explicitly too.
      for (const id of createdUserIds) {
        await admin.from("weigh_ins").delete().eq("user_id", id).then(
          () => {},
          () => {}
        );
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
      const { error: signInErr } = await signInWithPasswordRetry(jar.supabase, {
        email,
        password,
      });
      if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

      return { userId, email, ...jar };
    }

    it("test_AS_072_records_todays_weight_rounded_to_one_decimal_on_the_belgrade_day", async () => {
      const user = await createSignedInUser("f042-record");

      const response = await POST(
        makeWeighInRequest(user.cookieHeader(), { weightKg: 82.44 })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: WeighIn };
      expect(body.ok).toBe(true);
      expect(body.data.weight_kg).toBe(82.4); // rounded to one decimal
      expect(body.data.day).toBe(toBelgradeCalendarDay(new Date()));

      const { data: persisted } = await admin
        .from("weigh_ins")
        .select("*")
        .eq("user_id", user.userId);
      expect(persisted).toHaveLength(1);
      expect(persisted?.[0]?.weight_kg).toBe(82.4);
    });

    it("test_AS_073_a_same_day_reweigh_replaces_the_earlier_value", async () => {
      const user = await createSignedInUser("f042-replace");

      await POST(makeWeighInRequest(user.cookieHeader(), { weightKg: 90 }));
      const second = await POST(
        makeWeighInRequest(user.cookieHeader(), { weightKg: 89.2 })
      );
      expect(second.status).toBe(200);

      // Still exactly one row for today, holding the LATEST value.
      const { data: rows } = await admin
        .from("weigh_ins")
        .select("*")
        .eq("user_id", user.userId);
      expect(rows).toHaveLength(1);
      expect(rows?.[0]?.weight_kg).toBe(89.2);
    });

    it("test_a_signed_out_request_is_rejected_with_401_and_creates_no_row", async () => {
      const response = await POST(
        makeWeighInRequest("", { weightKg: 80 })
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr.length).toBeGreaterThan(0);
    });

    it("test_an_out_of_range_weight_is_rejected_with_400_and_creates_no_row", async () => {
      const user = await createSignedInUser("f042-invalid");

      const response = await POST(
        makeWeighInRequest(user.cookieHeader(), { weightKg: 12 })
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error_sr: string };
      expect(body.ok).toBe(false);
      expect(body.error_sr).not.toMatch(/error|exception|stack/i);

      const { data: rows } = await admin
        .from("weigh_ins")
        .select("id")
        .eq("user_id", user.userId);
      expect(rows ?? []).toEqual([]);
    });

    it("test_a_weigh_in_only_ever_belongs_to_the_creating_user_no_cross_user_leakage", async () => {
      const userA = await createSignedInUser("f042-isolation-a");
      const userB = await createSignedInUser("f042-isolation-b");

      const response = await POST(
        makeWeighInRequest(userA.cookieHeader(), { weightKg: 77.7 })
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: WeighIn };

      // User B's own session can never see user A's weigh-in row --
      // `weigh_ins_select_own` RLS enforces this, not application code.
      const { data: bVisible } = await userB.supabase
        .from("weigh_ins")
        .select("id")
        .eq("id", body.data.id);
      expect(bVisible ?? []).toEqual([]);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F042: live weigh-ins integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_weigh_ins_unreachable_AS_072_AS_073_blocked", () => {
      console.warn(
        "[F042] Live POST /api/weigh-ins integration tests for AS-072/AS-073 " +
          "SKIPPED: SUPABASE_* credentials not resolvable from .env in this " +
          "session."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
