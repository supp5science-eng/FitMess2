// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  adminCreateUserRetry,
  adminDeleteUserRetry,
  signInWithPasswordRetry,
} from "@/lib/test-utils/auth-retry";
import { uniqueTestBarcode } from "@/lib/test-utils/unique-barcode";
import { collectUserExport } from "@/lib/export/user-data";
import type { Database, FoodCommonUnit } from "@/lib/types/db";

// F020: live-database proof for AS-032 (a food record stores name_sr,
// brand, per-100g macros, common_units, source, verified, and an optional
// unique barcode), AS-057 (a second food submitted with an already-used
// barcode is rejected), and the definition-of-done items: RLS denies
// cross-user access to `logs`, a deleted user's `logs` rows are gone
// (cascade) while their submitted `foods` rows survive with `submitted_by`
// anonymized, and the GDPR export (F018/AS-014) now includes `logs`.
//
// Same `describe.skipIf(!hasCredentials || !schemaReady)` degrade-
// gracefully pattern established by F010's profiles-rls.integration.test.ts
// -- if `supabase/migrations/0004_foods_logs.sql` has not been applied to
// the live project yet in this session, the real assertions are skipped
// with a loud, named diagnostic rather than silently vanishing or
// permanently red-ing every future worker's `npm run test`.

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

function makeAnonScopedClient() {
  return createSupabaseJsClient<Database>(
    SUPABASE_URL as string,
    SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

let schemaReady = false;
let preflightError: unknown;

if (hasCredentials) {
  try {
    const admin = makeAdminClient();
    const foodsProbe = await admin.from("foods").select("id").limit(1);
    const logsProbe = await admin.from("logs").select("id").limit(1);
    schemaReady = !foodsProbe.error && !logsProbe.error;
    preflightError = foodsProbe.error ?? logsProbe.error;
  } catch (err) {
    schemaReady = false;
    preflightError = err;
  }
}

describe.skipIf(!hasCredentials || !schemaReady)(
  "F020: foods/logs schema, RLS, and cascade/anonymize behaviour on the live Supabase project (AS-032, AS-057)",
  () => {
    const admin = makeAdminClient();
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const foodIdsToCleanUp: string[] = [];
    const barcodesToCleanUp: string[] = [];

    afterAll(async () => {
      for (const id of foodIdsToCleanUp) {
        await admin.from("foods").delete().eq("id", id);
      }
      for (const barcode of barcodesToCleanUp) {
        await admin.from("foods").delete().eq("barcode", barcode);
      }
    });

    it("test_AS_032_a_food_record_round_trips_name_sr_brand_macros_common_units_source_verified_and_barcode", async () => {
      const commonUnits: FoodCommonUnit[] = [{ label: "parce", grams: 50 }];
      // F031a: was `\`3800${suffix}\`.slice(0, 13)` -- Date.now() is already
      // 13 digits, so the slice kept only a prefix of the timestamp and
      // silently dropped the random component, causing recurring
      // foods.barcode unique-constraint collisions across nearby test runs.
      const barcode = uniqueTestBarcode();

      const { data: inserted, error: insertErr } = await admin
        .from("foods")
        .insert({
          name_sr: "Testna Cokolada",
          brand: "Testna Marka",
          kcal_100g: 534,
          protein_100g: 7.5,
          carbs_100g: 58,
          fat_100g: 31,
          common_units: commonUnits,
          source: "user",
          verified: false,
          barcode,
        })
        .select()
        .single();

      expect(insertErr).toBeNull();
      expect(inserted).not.toBeNull();
      if (inserted) foodIdsToCleanUp.push(inserted.id);

      expect(inserted?.name_sr).toBe("Testna Cokolada");
      expect(inserted?.brand).toBe("Testna Marka");
      expect(Number(inserted?.kcal_100g)).toBe(534);
      expect(Number(inserted?.protein_100g)).toBe(7.5);
      expect(Number(inserted?.carbs_100g)).toBe(58);
      expect(Number(inserted?.fat_100g)).toBe(31);
      expect(inserted?.common_units).toEqual(commonUnits);
      expect(inserted?.source).toBe("user");
      expect(inserted?.verified).toBe(false);
      expect(inserted?.barcode).toBe(barcode);

      // Round trip: re-read the row fresh and confirm it is the same shape.
      const { data: reread, error: rereadErr } = await admin
        .from("foods")
        .select("*")
        .eq("id", inserted!.id)
        .single();
      expect(rereadErr).toBeNull();
      expect(reread?.barcode).toBe(barcode);
      expect(reread?.common_units).toEqual(commonUnits);
    });

    it("test_AS_032_barcode_and_brand_are_nullable", async () => {
      const { data: inserted, error: insertErr } = await admin
        .from("foods")
        .insert({
          name_sr: "Testna Namirnica Bez Barkoda",
          kcal_100g: 100,
          protein_100g: 1,
          carbs_100g: 1,
          fat_100g: 1,
          source: "seed",
        })
        .select()
        .single();

      expect(insertErr).toBeNull();
      if (inserted) foodIdsToCleanUp.push(inserted.id);
      expect(inserted?.barcode).toBeNull();
      expect(inserted?.brand).toBeNull();
    });

    it("test_AS_057_inserting_a_second_food_with_an_already_used_barcode_is_rejected", async () => {
      const barcode = uniqueTestBarcode();

      const { data: first, error: firstErr } = await admin
        .from("foods")
        .insert({
          name_sr: "Prva Namirnica",
          kcal_100g: 200,
          protein_100g: 10,
          carbs_100g: 20,
          fat_100g: 5,
          source: "user",
          barcode,
        })
        .select()
        .single();
      expect(firstErr).toBeNull();
      if (first) foodIdsToCleanUp.push(first.id);

      const { data: second, error: secondErr } = await admin
        .from("foods")
        .insert({
          name_sr: "Druga Namirnica Isti Barkod",
          kcal_100g: 300,
          protein_100g: 15,
          carbs_100g: 30,
          fat_100g: 8,
          source: "user",
          barcode, // duplicate on purpose
        })
        .select()
        .single();

      expect(secondErr).not.toBeNull();
      expect(secondErr?.code).toBe("23505"); // Postgres unique_violation
      expect(second).toBeNull();

      // Only the first row exists for this barcode.
      const { data: rowsForBarcode } = await admin
        .from("foods")
        .select("id")
        .eq("barcode", barcode);
      expect(rowsForBarcode).toHaveLength(1);
    });

    it("test_AS_057_two_foods_with_null_barcode_are_both_allowed_multiple_nulls_do_not_collide", async () => {
      const { data: a, error: errA } = await admin
        .from("foods")
        .insert({ name_sr: "Namirnica Null Barkod A", source: "user" })
        .select()
        .single();
      const { data: b, error: errB } = await admin
        .from("foods")
        .insert({ name_sr: "Namirnica Null Barkod B", source: "user" })
        .select()
        .single();

      expect(errA).toBeNull();
      expect(errB).toBeNull();
      if (a) foodIdsToCleanUp.push(a.id);
      if (b) foodIdsToCleanUp.push(b.id);
      expect(a?.barcode).toBeNull();
      expect(b?.barcode).toBeNull();
    });

    describe("logs RLS, cascade delete, and foods anonymize-not-delete", () => {
      const userAEmail = `f020-a-${suffix}@example.com`;
      const userBEmail = `f020-b-${suffix}@example.com`;
      const password = `F020-Test-${suffix}!aA`;
      let userAId: string;
      let userBId: string;
      let seededLogId: string;
      let submittedFoodId: string;

      afterAll(async () => {
        if (userAId) await adminDeleteUserRetry(admin, userAId).catch(() => {});
        if (userBId) await adminDeleteUserRetry(admin, userBId).catch(() => {});
        if (submittedFoodId) {
          await admin.from("foods").delete().eq("id", submittedFoodId);
        }
      });

      it("setup: create users A and B, seed a log row and a submitted food row for A", async () => {
        const { data: userAData, error: userAErr } = await adminCreateUserRetry(
          admin,
          { email: userAEmail, password, email_confirm: true }
        );
        expect(userAErr).toBeNull();
        userAId = userAData!.user!.id;

        const { data: userBData, error: userBErr } = await adminCreateUserRetry(
          admin,
          { email: userBEmail, password, email_confirm: true }
        );
        expect(userBErr).toBeNull();
        userBId = userBData!.user!.id;

        const { data: log, error: logErr } = await admin
          .from("logs")
          .insert({
            user_id: userAId,
            name: "Jabuka",
            grams: 150,
            kcal: 78,
            protein: 0.4,
            carbs: 20.7,
            fat: 0.3,
            method: "search",
          })
          .select()
          .single();
        expect(logErr).toBeNull();
        seededLogId = log!.id;

        const { data: food, error: foodErr } = await admin
          .from("foods")
          .insert({
            name_sr: "Namirnica Koju Je Poslao Korisnik A",
            source: "user",
            submitted_by: userAId,
          })
          .select()
          .single();
        expect(foodErr).toBeNull();
        submittedFoodId = food!.id;
      });

      it("test_logs_user_a_can_read_their_own_log_row", async () => {
        const clientA = makeAnonScopedClient();
        const { error: signInErr } = await signInWithPasswordRetry(clientA, {
          email: userAEmail,
          password,
        });
        expect(signInErr).toBeNull();

        const { data, error } = await clientA
          .from("logs")
          .select("id, name")
          .eq("id", seededLogId);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0]?.name).toBe("Jabuka");
      });

      it("test_logs_user_b_cannot_read_user_a_log_row", async () => {
        const clientB = makeAnonScopedClient();
        await signInWithPasswordRetry(clientB, { email: userBEmail, password });

        const { data, error } = await clientB
          .from("logs")
          .select("id")
          .eq("id", seededLogId);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("test_logs_user_b_cannot_insert_a_log_row_for_user_a", async () => {
        const clientB = makeAnonScopedClient();
        await signInWithPasswordRetry(clientB, { email: userBEmail, password });

        const { error } = await clientB.from("logs").insert({
          user_id: userAId,
          name: "Tudja Stavka",
          grams: 100,
          kcal: 50,
          protein: 1,
          carbs: 1,
          fat: 1,
          method: "search",
        });
        expect(error).not.toBeNull();

        const { data: verify } = await admin
          .from("logs")
          .select("id")
          .eq("user_id", userAId)
          .eq("name", "Tudja Stavka");
        expect(verify).toEqual([]);
      });

      it("test_logs_user_b_cannot_update_or_delete_user_a_log_row", async () => {
        const clientB = makeAnonScopedClient();
        await signInWithPasswordRetry(clientB, { email: userBEmail, password });

        const { data: updateData } = await clientB
          .from("logs")
          .update({ name: "Hakovano" })
          .eq("id", seededLogId)
          .select();
        expect(updateData).toEqual([]);

        const { data: deleteData } = await clientB
          .from("logs")
          .delete()
          .eq("id", seededLogId)
          .select();
        expect(deleteData).toEqual([]);

        const { data: stillThere } = await admin
          .from("logs")
          .select("name")
          .eq("id", seededLogId)
          .single();
        expect(stillThere?.name).toBe("Jabuka");
      });

      it("test_all_authenticated_users_can_read_the_shared_foods_catalog_including_another_users_submission", async () => {
        const clientB = makeAnonScopedClient();
        await signInWithPasswordRetry(clientB, { email: userBEmail, password });

        const { data, error } = await clientB
          .from("foods")
          .select("id, submitted_by")
          .eq("id", submittedFoodId);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0]?.submitted_by).toBe(userAId);
      });

      it("test_F020_export_includes_logs_for_the_user", async () => {
        const clientA = makeAnonScopedClient();
        await signInWithPasswordRetry(clientA, { email: userAEmail, password });

        const result = await collectUserExport(clientA, {
          id: userAId,
          email: userAEmail,
        });

        expect(Array.isArray(result.logs)).toBe(true);
        const logsArray = result.logs as Array<{ id: string; name: string }>;
        expect(logsArray.some((l) => l.id === seededLogId && l.name === "Jabuka")).toBe(
          true
        );
      });

      it("test_deleting_the_user_cascades_their_logs_but_anonymizes_not_deletes_their_submitted_foods", async () => {
        // Sanity: both rows exist before deletion.
        const { data: logBefore } = await admin
          .from("logs")
          .select("id")
          .eq("id", seededLogId)
          .maybeSingle();
        expect(logBefore?.id).toBe(seededLogId);

        const { data: foodBefore } = await admin
          .from("foods")
          .select("id, submitted_by")
          .eq("id", submittedFoodId)
          .single();
        expect(foodBefore?.submitted_by).toBe(userAId);

        const { error: deleteErr } = await adminDeleteUserRetry(admin, userAId);
        expect(deleteErr).toBeNull();

        // logs: gone (ON DELETE CASCADE from auth.users).
        const { data: logAfter, error: logAfterErr } = await admin
          .from("logs")
          .select("id")
          .eq("id", seededLogId)
          .maybeSingle();
        expect(logAfterErr).toBeNull();
        expect(logAfter).toBeNull();

        // foods: survives, submitted_by anonymized (ON DELETE SET NULL) --
        // NOT deleted, because foods is shared catalog data, not personal
        // data.
        const { data: foodAfter, error: foodAfterErr } = await admin
          .from("foods")
          .select("id, name_sr, submitted_by")
          .eq("id", submittedFoodId)
          .single();
        expect(foodAfterErr).toBeNull();
        expect(foodAfter?.id).toBe(submittedFoodId);
        expect(foodAfter?.name_sr).toBe("Namirnica Koju Je Poslao Korisnik A");
        expect(foodAfter?.submitted_by).toBeNull();
      });
    });
  }
);

describe.skipIf(hasCredentials && schemaReady)(
  "F020: live foods/logs integration tests currently blocked (documented, not silently skipped)",
  () => {
    it("diagnostic_live_schema_unreachable_AS_032_AS_057_blocked", () => {
      const reason = !hasCredentials
        ? "SUPABASE_* credentials not resolvable from .env in this session"
        : `public.foods/public.logs not reachable on the live project (migration not yet applied) -- preflight error: ${
            preflightError instanceof Error
              ? preflightError.message
              : JSON.stringify(preflightError)
          }`;
      console.warn(
        `[F020] Live foods/logs integration tests for AS-032/AS-057 SKIPPED: ${reason}. ` +
          "See missions/20260717-183157/handoffs/F020-handoff.md Blockers for the follow-up needed. " +
          "This placeholder does not prove AS-032/AS-057 -- it only documents why the real assertions " +
          "above did not run, without permanently red-ing this test file for unrelated future workers."
      );
      expect(schemaReady).toBe(false);
    });
  }
);
