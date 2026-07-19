import { describe, expect, it, vi } from "vitest";

import { updateProfileData, type UpdateProfileInput } from "../update-profile";

// Unit coverage for `updateProfileData`'s server-side re-validation + the
// recompute/write shape, using a mock Supabase client (same style as
// `src/lib/onboarding/__tests__/persist.test.ts`). It never trusts client
// input, carries the goal forward from the newest targets row, recomputes the
// budget, updates `profiles`, and inserts a NEW `targets` row.

const VALID: UpdateProfileInput = {
  name: "Ana",
  sex: "female",
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  activityLevel: "moderate",
};

type LatestTarget = {
  goal: "lose" | "gain" | "maintain" | "tone" | null;
  goal_weight_kg: number | null;
  timeframe_weeks: number | null;
} | null;

function makeMockSupabase(options?: {
  latestTarget?: LatestTarget;
  targetReadError?: { message: string };
  profileError?: { message: string };
  targetsError?: { message: string };
}) {
  const updateEq = vi
    .fn()
    .mockResolvedValue({ error: options?.profileError ?? null });
  const update = vi.fn<
    (payload: Record<string, unknown>) => { eq: typeof updateEq }
  >(() => ({ eq: updateEq }));
  const insert = vi.fn<
    (payload: Record<string, unknown>) => Promise<{
      error: { message: string } | null;
    }>
  >(() => Promise.resolve({ error: options?.targetsError ?? null }));

  const maybeSingle = vi.fn().mockResolvedValue({
    data:
      options && "latestTarget" in options
        ? options.latestTarget
        : { goal: "lose", goal_weight_kg: 74, timeframe_weeks: 12 },
    error: options?.targetReadError ?? null,
  });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const eqSelect = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq: eqSelect }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update };
    if (table === "targets") return { select, insert };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, update, updateEq, insert, select } as unknown as {
    from: typeof from;
    update: typeof update;
    updateEq: typeof updateEq;
    insert: typeof insert;
    select: typeof select;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (m: ReturnType<typeof makeMockSupabase>) => m as any;

describe("updateProfileData: server-side re-validation (never trusts client input)", () => {
  it("rejects a missing name before touching the database", async () => {
    const supabase = makeMockSupabase();
    const result = await updateProfileData(asClient(supabase), "user-1", {
      ...VALID,
      name: "   ",
    });
    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range weight before writing anything", async () => {
    const supabase = makeMockSupabase();
    const result = await updateProfileData(asClient(supabase), "user-1", {
      ...VALID,
      weightKg: 5,
    });
    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rejects a missing activity level before writing anything", async () => {
    const supabase = makeMockSupabase();
    const result = await updateProfileData(asClient(supabase), "user-1", {
      ...VALID,
      activityLevel: null,
    });
    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
  });
});

describe("updateProfileData: recompute + write shape", () => {
  it("updates the profile fields and inserts a fresh recomputed targets row, carrying the goal forward", async () => {
    const supabase = makeMockSupabase({
      latestTarget: { goal: "lose", goal_weight_kg: 74, timeframe_weeks: 12 },
    });
    const result = await updateProfileData(asClient(supabase), "user-1", {
      ...VALID,
      weightKg: 78,
    });

    expect(result.ok).toBe(true);

    const profilePayload = supabase.update.mock.calls[0][0];
    expect(profilePayload).toMatchObject({
      full_name: "Ana",
      sex: "female",
      height_cm: 168,
      weight_kg: 78,
      activity_level: "moderate",
    });
    // Not part of an edit: onboarding marker + eating rules stay untouched.
    expect(profilePayload).not.toHaveProperty("onboarded_at");
    expect(profilePayload).not.toHaveProperty("rules");

    const targetPayload = supabase.insert.mock.calls[0][0];
    expect(targetPayload.user_id).toBe("user-1");
    expect(targetPayload.goal).toBe("lose");
    expect(targetPayload.goal_weight_kg).toBe(74);
    expect(targetPayload.timeframe_weeks).toBe(12);
    expect(targetPayload.daily_kcal).toBeGreaterThan(0);
    expect(targetPayload.protein_g).toBeGreaterThan(0);
  });

  it("falls back to maintenance when the edited weight has already met a lose goal", async () => {
    const supabase = makeMockSupabase({
      latestTarget: { goal: "lose", goal_weight_kg: 74, timeframe_weeks: 12 },
    });
    // New weight (72) is already below the 74 kg lose target.
    const result = await updateProfileData(asClient(supabase), "user-1", {
      ...VALID,
      weightKg: 72,
    });

    expect(result.ok).toBe(true);
    const targetPayload = supabase.insert.mock.calls[0][0];
    expect(targetPayload.goal).toBe("maintain");
    expect(targetPayload.goal_weight_kg).toBeNull();
    expect(targetPayload.timeframe_weeks).toBeNull();
  });

  it("defaults to maintenance when there is no prior targets row", async () => {
    const supabase = makeMockSupabase({ latestTarget: null });
    const result = await updateProfileData(asClient(supabase), "user-1", VALID);
    expect(result.ok).toBe(true);
    expect(supabase.insert.mock.calls[0][0].goal).toBe("maintain");
  });

  it("surfaces a save error and does not insert a targets row when the profile update fails", async () => {
    const supabase = makeMockSupabase({
      profileError: { message: "boom" },
    });
    const result = await updateProfileData(asClient(supabase), "user-1", VALID);
    expect(result.ok).toBe(false);
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
