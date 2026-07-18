// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { persistOnboarding } from "@/lib/onboarding/persist";
import { regenerateRules, updateRules } from "@/lib/profil/rules-settings";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";
import type { PersistedRule } from "@/lib/budget/rules";

// F017 / AS-029: the live-project proof that toggling/editing rules on
// `/profil/pravila` actually round-trips through the real signed-in
// session client (RLS-enforced, own-row only -- AS-013) and lands in the
// real `profiles.rules` column. Exercises `updateRules`/`regenerateRules`
// directly (the same functions the `"use server"` actions in
// `src/app/(app)/profil/pravila/actions.ts` call) -- same live-integration
// shape F016's `actions.integration.test.ts` established.

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

  return { supabase };
}

const ONBOARDING_DATA: OnboardingData = {
  sex: "female",
  ageYears: 31,
  heightCm: 165,
  weightKg: 78,
  activityLevel: "light",
  targetWeightKg: 70,
  timeframeWeeks: 16,
};

describe.skipIf(!hasCredentials)(
  "F017 / AS-029: toggling and editing rules persists via the live session client",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = `F017-Test-${suffix}!aA`;
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await adminDeleteUserRetry(admin, id).catch(() => {});
      }
    });

    async function createOnboardedUser(emailPrefix: string) {
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

      const result = await persistOnboarding(jar.supabase, userId, ONBOARDING_DATA);
      expect(result.ok).toBe(true);

      return { userId, supabase: jar.supabase };
    }

    it("test_AS_029_toggling_a_rule_off_via_the_session_client_persists_in_the_real_profiles_row", async () => {
      const { userId, supabase } = await createOnboardedUser("f017-toggle");

      const { data: before } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const originalRules = (before?.rules ?? []) as PersistedRule[];
      expect(originalRules.length).toBeGreaterThanOrEqual(3);

      const toggledRules: PersistedRule[] = originalRules.map((rule, index) =>
        index === 0 ? { ...rule, enabled: !rule.enabled } : rule
      );

      const result = await updateRules(supabase, userId, toggledRules);
      expect(result.ok).toBe(true);

      const { data: after } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const persistedRules = (after?.rules ?? []) as PersistedRule[];

      expect(persistedRules[0]?.enabled).toBe(toggledRules[0].enabled);
      expect(persistedRules[0]?.enabled).not.toBe(originalRules[0].enabled);
    });

    it("test_AS_029_editing_a_rules_text_via_the_session_client_persists_the_new_text", async () => {
      const { userId, supabase } = await createOnboardedUser("f017-edit");

      const { data: before } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const originalRules = (before?.rules ?? []) as PersistedRule[];

      const editedText = "Izmenjeno pravilo za test AS-029.";
      const editedRules: PersistedRule[] = originalRules.map((rule, index) =>
        index === 0 ? { ...rule, textSr: editedText } : rule
      );

      const result = await updateRules(supabase, userId, editedRules);
      expect(result.ok).toBe(true);

      const { data: after } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const persistedRules = (after?.rules ?? []) as PersistedRule[];

      expect(persistedRules[0]?.textSr).toBe(editedText);
    });

    it("test_AS_029_another_users_session_client_cannot_overwrite_this_users_rules", async () => {
      const { userId } = await createOnboardedUser("f017-owner");
      const { supabase: intruderSupabase } = await createOnboardedUser("f017-intruder");

      const { data: before } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const originalRules = (before?.rules ?? []) as PersistedRule[];

      // The intruder's own session client attempts to write into the
      // *owner's* user_id -- RLS's own-row `with check` (AS-013) must make
      // this a no-op (zero rows affected), not an error and not a write.
      await updateRules(intruderSupabase, userId, [
        { id: "hacked", textSr: "Hakovano pravilo.", enabled: true },
      ]);

      const { data: after } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();

      expect(after?.rules).toEqual(originalRules);
    });

    it("test_AS_029_regenerate_recomputes_and_persists_a_fresh_3_to_5_rule_set", async () => {
      const { userId, supabase } = await createOnboardedUser("f017-regen");

      const result = await regenerateRules(supabase, userId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.rules.length).toBeGreaterThanOrEqual(3);
      expect(result.rules.length).toBeLessThanOrEqual(5);

      const { data: after } = await admin
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .single();
      const persistedRules = (after?.rules ?? []) as PersistedRule[];

      expect(persistedRules.length).toBe(result.rules.length);
    });
  }
);

describe.skipIf(hasCredentials)(
  "F017: live rules-settings integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_credentials_unreachable_AS_029_blocked", () => {
      console.warn(
        "[F017] Live rules-settings integration tests for AS-029 SKIPPED: " +
          "SUPABASE_* credentials not resolvable from .env in this session. " +
          "See missions/20260717-183157/handoffs/F017-handoff.md."
      );
      expect(hasCredentials).toBe(false);
    });
  }
);
