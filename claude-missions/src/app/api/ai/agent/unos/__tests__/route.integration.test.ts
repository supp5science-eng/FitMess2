// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { POST } from "@/app/api/ai/agent/unos/route";
import { buildAgentMealDraft } from "@/lib/ai/agent-draft";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database, Log } from "@/lib/types/db";

// Izvršni put (2026-08-26) -- live-project proof that a CONFIRMED Prizma
// draft becomes real `logs` rows through the SIGNED-IN user's own session
// (RLS-governed), with the occasion totals the confirm screen showed, and
// that an unauthenticated caller writes nothing at all.
//
// The pure half (grouping, totals, the confirm boundary) is covered without a
// database in `src/lib/ai/__tests__/agent-draft.test.ts`; what only a live
// project can prove is the RLS-governed write itself.
//
// Follows the same `describe.skipIf(!hasCredentials)` cookie-jar pattern as
// `src/app/api/logs/__tests__/route.integration.test.ts` (see that file's
// header comment for the full rationale).

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

function makeConfirmRequest(cookieHeader: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/agent/unos", {
    method: "POST",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** The model answer behind "jutros dva jaja i jogurt, pa kasnije jabuka":
 * two eating occasions, the first with two parts. */
const MODEL_DRAFT = {
  obroci: [
    {
      stavke: [
        {
          naziv: "Jaja",
          kolicina: "2 komada",
          grami: 120,
          kcal: 186,
          protein_g: 15.6,
          uh_g: 1.2,
          mast_g: 13.2,
          varijansa: "niska",
        },
        {
          naziv: "Jogurt",
          kolicina: "1 čaša",
          grami: 200,
          kcal: 122,
          protein_g: 8,
          uh_g: 9.4,
          mast_g: 6.4,
          varijansa: "niska",
        },
      ],
    },
    {
      stavke: [
        {
          naziv: "Jabuka",
          kolicina: "1 komad",
          grami: 180,
          kcal: 94,
          protein_g: 0.5,
          uh_g: 25,
          mast_g: 0.3,
          varijansa: "niska",
        },
      ],
    },
  ],
};

describe.skipIf(!hasCredentials)(
  "POST /api/ai/agent/unos on the live Supabase project",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `Prizma-Unos-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await admin
          .from("logs")
          .delete()
          .eq("user_id", id)
          .then(() => {}, () => {});
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

    it("writes one row per eating occasion, with exactly the totals the user confirmed", async () => {
      const user = await createSignedInUser("prizma-unos");
      const draft = buildAgentMealDraft(MODEL_DRAFT);
      expect(draft).not.toBeNull();
      if (!draft) return;

      const response = await POST(
        makeConfirmRequest(user.cookieHeader(), { items: draft.items })
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        saved: number;
        totalKcal: number;
      };
      expect(body.ok).toBe(true);
      expect(body.saved).toBe(2);
      expect(body.totalKcal).toBe(draft.totalKcal);

      const { data: rows } = await admin
        .from("logs")
        .select("*")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: true });
      const logs = (rows ?? []) as Log[];
      expect(logs).toHaveLength(2);

      // The plate on the confirm screen IS the row in the database.
      const joined = logs.find((log) => log.name === "Jaja i jogurt");
      expect(joined).toBeDefined();
      expect(joined?.kcal).toBe(draft.occasions[0].kcal);
      expect(joined?.grams).toBe(draft.occasions[0].grams);
      expect(joined?.protein).toBe(draft.occasions[0].protein);
      // The breakdown survives, so "Dodaj još" still works on a Prizma entry.
      expect(joined?.components).toHaveLength(2);
      // Every row is stamped as the agent's, never as a search or a photo.
      expect(logs.every((log) => log.method === "agent")).toBe(true);
      expect(logs.every((log) => log.food_id === null)).toBe(true);

      const apple = logs.find((log) => log.name === "Jabuka");
      expect(apple?.components).toBeNull();
    });

    it("refuses a malformed draft and writes nothing", async () => {
      const user = await createSignedInUser("prizma-unos-bad");

      const response = await POST(
        makeConfirmRequest(user.cookieHeader(), { items: [] })
      );
      expect(response.status).toBe(400);

      const { count } = await admin
        .from("logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.userId);
      expect(count ?? 0).toBe(0);
    });

    it("a caller with no session writes nothing", async () => {
      const draft = buildAgentMealDraft(MODEL_DRAFT);
      const response = await POST(
        makeConfirmRequest("", { items: draft?.items })
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(false);
    });
  }
);
