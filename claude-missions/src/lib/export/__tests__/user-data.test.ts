import { describe, expect, it, vi } from "vitest";

import { collectUserExport, ExportReadError } from "../user-data";
import type { EatingRuleJson } from "@/lib/types/db";

// F018 / AS-014: unit coverage for `collectUserExport`'s shape, extension
// point, and failure behaviour using a mock Supabase client -- the live
// round-trip against a real project (including the cross-user negative
// case) is covered by `src/app/api/export/__tests__/route.integration.test.ts`.

const RULES: EatingRuleJson[] = [
  { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka svaki dan.", enabled: true },
  { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: false },
  { id: "voda", textSr: "Popij dovoljno vode.", enabled: true },
];

const PROFILE_ROW = {
  user_id: "user-1",
  sex: "female",
  birth_year: 1996,
  height_cm: 168,
  weight_kg: 78,
  activity_level: "light",
  is_admin: false,
  onboarded_at: "2026-07-01T00:00:00.000Z",
  rules: RULES,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const TARGET_ROWS = [
  {
    id: "target-1",
    user_id: "user-1",
    daily_kcal: 1800,
    protein_g: 120,
    fat_g: 60,
    carbs_g: 180,
    weekly_kcal: 12600,
    goal_weight_kg: 70,
    timeframe_weeks: 16,
    effective_from: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
  },
];

// F020: `logs` is the first table wired through the `USER_OWNED_TABLES`
// extension point (see the header comment in `../user-data.ts`).
const LOG_ROWS = [
  {
    id: "log-1",
    user_id: "user-1",
    food_id: "food-1",
    name: "Jabuka",
    grams: 150,
    kcal: 78,
    protein: 0.4,
    carbs: 20.7,
    fat: 0.3,
    logged_at: "2026-07-01T08:00:00.000Z",
    method: "search",
    created_at: "2026-07-01T08:00:00.000Z",
  },
];

// F042: `weigh_ins` is folded into the export via the same extension point.
const WEIGH_IN_ROWS = [
  {
    id: "weigh-1",
    user_id: "user-1",
    day: "2026-07-01",
    weight_kg: 78,
    created_at: "2026-07-01T06:00:00.000Z",
    updated_at: "2026-07-01T06:00:00.000Z",
  },
];

const WATER_ROWS = [
  {
    id: "water-1",
    user_id: "user-1",
    day: "2026-07-01",
    ml: 1750,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T19:00:00.000Z",
  },
];

const STEP_ROWS = [
  {
    id: "steps-1",
    user_id: "user-1",
    day: "2026-07-01",
    steps: 8400,
    created_at: "2026-07-01T21:00:00.000Z",
    updated_at: "2026-07-01T21:00:00.000Z",
  },
];

const HABIT_CHECK_ROWS = [
  {
    id: "check-1",
    user_id: "user-1",
    habit_id: "povrce-svaki-dan",
    day: "2026-07-01",
    created_at: "2026-07-01T20:00:00.000Z",
  },
];

const MEAL_PHOTO_ROWS = [
  {
    log_id: "log-1",
    mime_type: "image/jpeg",
    created_at: "2026-07-01T08:00:00.000Z",
  },
];

type TableResult = {
  data?: Record<string, unknown>[] | null;
  error?: { message: string; code?: string } | null;
};

const REMINDER_SETTINGS_ROWS = [
  {
    user_id: "user-1",
    no_log_enabled: true,
    no_log_time: "12:00:00",
    no_log_last_sent: "2026-07-24",
    created_at: "2026-07-20T09:00:00.000Z",
    updated_at: "2026-07-24T12:00:00.000Z",
  },
];

// 0022 (Nagrade) and 0024 (Nedeljno merenje). Both were live in
// `USER_OWNED_TABLES` without a double here, which made the table stub throw
// "unexpected table" for every case in this file rather than for the one
// asserting on them -- the export is a generic loop, so ANY missing table
// takes the whole suite down. A new entry in `USER_OWNED_TABLES` needs a line
// here too.
const AWARD_ROWS = [
  {
    user_id: "user-1",
    day: "2026-07-24",
    kind: "pun-dan",
    created_at: "2026-07-24T21:00:00.000Z",
  },
];

const PLAN_ADJUSTMENT_ROWS = [
  {
    id: "adj-1",
    user_id: "user-1",
    day: "2026-08-01",
    old_kcal: 2600,
    new_kcal: 2400,
    reason: "STALLED",
    accepted: true,
    measured_tdee_kcal: 2600,
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: "2026-08-01T08:00:00.000Z",
  },
];

// 0026 (Trening).
const WORKOUT_ROWS = [
  {
    id: "workout-1",
    user_id: "user-1",
    day: "2026-08-01",
    activity_key: "teretana",
    intensity: "srednje",
    minutes: 60,
    kcal: 357,
    created_at: "2026-08-01T18:00:00.000Z",
  },
];

const FUNNEL_EVENT_ROWS = [
  {
    user_id: "user-1",
    event: "onboarding_step",
    value: "pol",
    at: "2026-08-01T08:00:00.000Z",
  },
];

const DAY_ANSWER_ROWS = [
  {
    id: "da-1",
    user_id: "user-1",
    day_key: "2026-08-05",
    answer: "complete",
    answered_on: "2026-08-06",
    created_at: "2026-08-06T09:00:00.000Z",
    updated_at: "2026-08-06T09:00:00.000Z",
  },
];

const DEFAULT_ROWS: Record<string, Record<string, unknown>[]> = {
  // The user's own statements about their own days -- in the export since
  // 2026-08-07, when they stopped living in a cookie (migration 0029).
  day_answers: DAY_ANSWER_ROWS,
  targets: TARGET_ROWS,
  logs: LOG_ROWS,
  weigh_ins: WEIGH_IN_ROWS,
  water_intake: WATER_ROWS,
  step_counts: STEP_ROWS,
  habit_checks: HABIT_CHECK_ROWS,
  reminder_settings: REMINDER_SETTINGS_ROWS,
  awards: AWARD_ROWS,
  plan_adjustments: PLAN_ADJUSTMENT_ROWS,
  workouts: WORKOUT_ROWS,
  funnel_events: FUNNEL_EVENT_ROWS,
  meal_photos: MEAL_PHOTO_ROWS,
};

/**
 * Generic table double: every list table answers `select(...).eq(...)`, so a
 * new entry in `USER_OWNED_TABLES` needs no new plumbing here -- only an
 * override when a test wants a specific failure.
 */
function makeMockSupabase(options?: {
  profile?: Record<string, unknown> | null;
  profileError?: { message: string };
  /** Per-table overrides, keyed by table name. */
  tables?: Record<string, TableResult>;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.profile === undefined ? PROFILE_ROW : options.profile,
    error: options?.profileError ?? null,
  });
  const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  /** Records the `select("…")` argument per table so tests can assert WHICH
   * columns were asked for (meal photos must never request the image). */
  const selectedColumns: Record<string, string> = {};
  const eqCalls: Record<string, [string, string][]> = {};

  function tableDouble(table: string) {
    const override = options?.tables?.[table];
    const result = {
      data: override?.data !== undefined ? override.data : DEFAULT_ROWS[table] ?? [],
      error: override?.error ?? null,
    };

    const eq = vi.fn((column: string, value: string) => {
      eqCalls[table] = [...(eqCalls[table] ?? []), [column, value]];
      return Promise.resolve(result);
    });

    return {
      select: vi.fn((columns: string) => {
        selectedColumns[table] = columns;
        return { eq };
      }),
    };
  }

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect };
    if (table in DEFAULT_ROWS) return tableDouble(table);
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, profileEq, selectedColumns, eqCalls } as unknown as {
    from: typeof from;
    profileEq: typeof profileEq;
    selectedColumns: Record<string, string>;
    eqCalls: Record<string, [string, string][]>;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function runExport(
  supabase: ReturnType<typeof makeMockSupabase>,
  email: string | null = null
) {
  return collectUserExport(supabase as any, { id: "user-1", email });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("collectUserExport: AS-014 -- builds a complete own-data export", () => {
  it("test_AS_014_includes_profile_targets_rules_exported_at_and_schema_note", async () => {
    const result = await runExport(makeMockSupabase(), "korisnik@example.com");

    expect(result.account).toEqual({ id: "user-1", email: "korisnik@example.com" });
    expect(result.profile).toMatchObject({ user_id: "user-1", sex: "female" });
    expect(result.rules).toEqual(RULES);
    expect(result.targets).toEqual(TARGET_ROWS);
    expect(result.logs).toEqual(LOG_ROWS);
    expect(result.weighIns).toEqual(WEIGH_IN_ROWS);
    expect(typeof result.exported_at).toBe("string");
    expect(() => new Date(result.exported_at).toISOString()).not.toThrow();
    expect(result.schema_note.length).toBeGreaterThan(0);
  });

  it("test_every_user_owned_table_is_part_of_the_export", async () => {
    // The export's own note promises "everything we store about you" -- a
    // table that ships without being wired in makes that a false claim, so
    // this test fails loudly the next time one is forgotten.
    const result = await runExport(makeMockSupabase());

    expect(result.waterIntake).toEqual(WATER_ROWS);
    expect(result.stepCounts).toEqual(STEP_ROWS);
    expect(result.habitChecks).toEqual(HABIT_CHECK_ROWS);
    expect(result.reminderSettings).toEqual(REMINDER_SETTINGS_ROWS);
    expect(result.mealPhotos).toEqual(MEAL_PHOTO_ROWS);
    expect(result.missing_sections).toEqual([]);
  });

  it("test_meal_photos_are_exported_without_the_image_bytes", async () => {
    // Inlined base64 images would turn a text export into megabytes built in
    // the serverless function's memory -- the rows are exported, the pictures
    // are not (and they self-delete after about a day anyway).
    const supabase = makeMockSupabase();
    await runExport(supabase);

    expect(supabase.selectedColumns.meal_photos).not.toMatch(/image_base64/);
    expect(supabase.selectedColumns.meal_photos).toMatch(/log_id/);
  });

  it("test_AS_014_schema_note_lists_every_currently_included_data_category", async () => {
    const result = await runExport(makeMockSupabase());

    expect(result.schema_note).toMatch(/profil/i);
    expect(result.schema_note).toMatch(/navike/i);
    expect(result.schema_note).toMatch(/ciljevi ishrane/i);
    expect(result.schema_note).toMatch(/dnevni unosi hrane/i);
    expect(result.schema_note).toMatch(/merenja težine/i);
    expect(result.schema_note).toMatch(/unos vode/i);
    expect(result.schema_note).toMatch(/koraci/i);
  });

  it("test_F020_foods_shared_catalog_table_is_never_part_of_the_per_user_export", async () => {
    const result = await runExport(makeMockSupabase());

    expect(result).not.toHaveProperty("foods");
    // The mock's `from` throws for any table it doesn't recognize -- if
    // collectUserExport ever queried `foods` here, this whole test would
    // throw instead of asserting cleanly.
  });

  it("test_AS_014_rules_are_not_duplicated_inside_the_profile_object", async () => {
    const result = await runExport(makeMockSupabase());
    expect(result.profile).not.toHaveProperty("rules");
  });

  it("test_AS_014_queries_are_scoped_to_the_given_user_id_defense_in_depth", async () => {
    const supabase = makeMockSupabase();
    await runExport(supabase);

    expect(supabase.profileEq).toHaveBeenCalledWith("user_id", "user-1");
    for (const table of Object.keys(DEFAULT_ROWS)) {
      expect(supabase.eqCalls[table]).toContainEqual(["user_id", "user-1"]);
    }
  });

  it("test_AS_014_a_user_with_no_profile_row_yet_gets_a_null_profile_and_empty_rules_not_an_error", async () => {
    const supabase = makeMockSupabase({
      profile: null,
      tables: { targets: { data: [] }, logs: { data: [] } },
    });

    const result = await runExport(supabase);

    expect(result.profile).toBeNull();
    expect(result.rules).toEqual([]);
    expect(result.targets).toEqual([]);
    expect(result.logs).toEqual([]);
  });
});

describe("collectUserExport: failure behaviour", () => {
  it("test_F020_a_logs_read_failure_throws_instead_of_returning_a_partial_export", async () => {
    const supabase = makeMockSupabase({
      tables: { logs: { data: null, error: { message: "db unreachable" } } },
    });

    await expect(runExport(supabase)).rejects.toBeInstanceOf(ExportReadError);
  });

  it("test_AS_014_a_profile_read_failure_throws_instead_of_returning_a_partial_export", async () => {
    const supabase = makeMockSupabase({ profileError: { message: "db unreachable" } });
    await expect(runExport(supabase)).rejects.toBeInstanceOf(ExportReadError);
  });

  it("test_AS_014_a_targets_read_failure_throws_instead_of_returning_a_partial_export", async () => {
    const supabase = makeMockSupabase({
      tables: { targets: { data: null, error: { message: "db unreachable" } } },
    });

    await expect(runExport(supabase)).rejects.toBeInstanceOf(ExportReadError);
  });

  it("test_a_table_that_does_not_exist_yet_is_reported_not_fatal", async () => {
    // A table listed in the export but not migrated onto this environment
    // (42P01) must not cost the user the rest of their data -- it is named in
    // `missing_sections` instead, so the gap is stated rather than hidden.
    const supabase = makeMockSupabase({
      tables: {
        habit_checks: {
          data: null,
          error: { message: 'relation "habit_checks" does not exist', code: "42P01" },
        },
      },
    });

    const result = await runExport(supabase);

    expect(result.missing_sections).toEqual(["čekirane navike po danima"]);
    expect(result).not.toHaveProperty("habitChecks");
    // Everything else still made it.
    expect(result.logs).toEqual(LOG_ROWS);
    expect(result.schema_note).toMatch(/Nedostupno u ovom izvozu/);
  });

  it("test_a_missing_meal_photos_table_is_also_only_reported", async () => {
    const supabase = makeMockSupabase({
      tables: {
        meal_photos: {
          data: null,
          error: { message: 'relation "meal_photos" does not exist', code: "42P01" },
        },
      },
    });

    const result = await runExport(supabase);

    expect(result.missing_sections).toHaveLength(1);
    expect(result.missing_sections[0]).toMatch(/slike obroka/i);
    expect(result).not.toHaveProperty("mealPhotos");
  });

  it("test_AS_014_a_read_error_message_never_leaks_the_raw_db_error_text", async () => {
    const supabase = makeMockSupabase({
      profileError: { message: "SUPER SECRET DB DETAIL" },
    });

    try {
      await runExport(supabase);
      throw new Error("expected collectUserExport to throw");
    } catch (err) {
      // The thrown error is an internal ExportReadError for the route
      // handler's catch block to log server-side; the ROUTE never forwards
      // this message to the client (see route.integration.test.ts).
      expect(err).toBeInstanceOf(ExportReadError);
    }
  });
});
