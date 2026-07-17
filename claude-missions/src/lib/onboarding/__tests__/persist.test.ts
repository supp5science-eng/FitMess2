import { describe, expect, it, vi } from "vitest";

import { ageYearsToBirthYear, persistOnboarding } from "../persist";
import { EMPTY_ONBOARDING_DATA } from "../types";
import type { OnboardingData } from "../types";

// F016: unit coverage for `persistOnboarding`'s validation + write shape
// (AS-020, AS-031), using a mock Supabase client -- the live write against
// a real project (RLS-enforced, real onboarded_at + targets row) is
// covered separately by the integration test in
// `src/app/(app)/onboarding/pregled/__tests__/actions.integration.test.ts`.

const VALID_DATA: OnboardingData = {
  sex: "female",
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  activityLevel: "moderate",
  targetWeightKg: 74,
  timeframeWeeks: 12,
};

function makeMockSupabase(options?: {
  profileError?: { message: string };
  targetsError?: { message: string };
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: options?.profileError ?? null });
  const update = vi.fn<(payload: Record<string, unknown>) => { eq: typeof updateEq }>(
    () => ({ eq: updateEq })
  );
  const insert = vi.fn<
    (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  >(() => Promise.resolve({ error: options?.targetsError ?? null }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update };
    if (table === "targets") return { insert };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, update, updateEq, insert } as unknown as {
    from: typeof from;
    update: typeof update;
    updateEq: typeof updateEq;
    insert: typeof insert;
  };
}

describe("ageYearsToBirthYear: converts collected age -> profiles.birth_year", () => {
  it("test_AS_031_subtracts_age_from_the_reference_years_current_year", () => {
    const now = new Date("2026-07-17T12:00:00Z");
    expect(ageYearsToBirthYear(29, now)).toBe(2026 - 29);
  });

  it("test_AS_031_rounds_a_fractional_age_before_subtracting", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(ageYearsToBirthYear(29.7, now)).toBe(2026 - 30);
  });
});

describe("persistOnboarding: server-side re-validation (never trusts client-sent data)", () => {
  it("test_AS_020_rejects_a_missing_sex_before_writing_anything", async () => {
    const supabase = makeMockSupabase();
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      { ...VALID_DATA, sex: null }
    );

    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("test_AS_020_rejects_an_out_of_range_age_before_writing_anything", async () => {
    const supabase = makeMockSupabase();
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      { ...VALID_DATA, ageYears: 5 }
    );

    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("test_AS_019_rejects_a_target_weight_not_below_current_weight_same_as_the_wizard", async () => {
    const supabase = makeMockSupabase();
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      { ...VALID_DATA, targetWeightKg: 85 }
    );

    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("test_AS_020_completely_empty_data_is_rejected", async () => {
    const supabase = makeMockSupabase();
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      EMPTY_ONBOARDING_DATA
    );
    expect(result.ok).toBe(false);
  });
});

describe("persistOnboarding: the write shape (AS-031: profiles update + targets insert)", () => {
  it("test_AS_031_valid_data_updates_profiles_with_onboarded_at_and_inserts_a_targets_row", async () => {
    const supabase = makeMockSupabase();
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      VALID_DATA
    );

    expect(result.ok).toBe(true);

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    const profilePayload = supabase.update.mock.calls[0][0];
    expect(profilePayload.sex).toBe("female");
    expect(profilePayload.height_cm).toBe(168);
    expect(profilePayload.weight_kg).toBe(80);
    expect(profilePayload.activity_level).toBe("moderate");
    expect(profilePayload.onboarded_at).not.toBeNull();
    expect(typeof profilePayload.onboarded_at).toBe("string");
    expect(supabase.updateEq).toHaveBeenCalledWith("user_id", "user-1");

    expect(supabase.from).toHaveBeenCalledWith("targets");
    const targetsPayload = supabase.insert.mock.calls[0][0] as {
      user_id: string;
      goal_weight_kg: number;
      timeframe_weeks: number;
      daily_kcal: number;
      weekly_kcal: number;
      protein_g: number;
      fat_g: number;
    };
    expect(targetsPayload.user_id).toBe("user-1");
    expect(targetsPayload.goal_weight_kg).toBe(74);
    expect(targetsPayload.timeframe_weeks).toBe(12);
    expect(targetsPayload.weekly_kcal).toBe(targetsPayload.daily_kcal * 7);
    expect(targetsPayload.protein_g).toBeGreaterThan(0);
    expect(targetsPayload.fat_g).toBeGreaterThan(0);
  });

  it("test_AS_031_a_profiles_update_error_is_surfaced_as_a_serbian_message_and_skips_the_targets_insert", async () => {
    const supabase = makeMockSupabase({
      profileError: { message: "db unreachable" },
    });
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      VALID_DATA
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_sr.length).toBeGreaterThan(0);
      expect(result.error_sr).not.toMatch(/db unreachable/);
    }
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("test_AS_031_a_targets_insert_error_is_surfaced_as_a_serbian_message", async () => {
    const supabase = makeMockSupabase({
      targetsError: { message: "constraint violation" },
    });
    const result = await persistOnboarding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      VALID_DATA
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_sr.length).toBeGreaterThan(0);
      expect(result.error_sr).not.toMatch(/constraint violation/);
    }
  });
});
