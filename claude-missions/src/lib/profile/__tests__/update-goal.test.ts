import { describe, expect, it, vi } from "vitest";

import { updateGoal } from "../update-goal";

// Unit coverage for `updateGoal`'s server-side re-validation + recompute/write
// shape, using a mock Supabase client (same style as update-profile.test.ts).
// It never trusts client input, reads the profile fresh, recomputes the budget
// from the F014 engine, and inserts a NEW `targets` row.

const NOW = new Date("2026-07-19T10:00:00.000Z");
const PROFILE = {
  sex: "male" as const,
  birth_year: 1996,
  height_cm: 180,
  weight_kg: 85,
  activity_level: "moderate" as const,
};

function makeMockSupabase(options?: {
  profile?: typeof PROFILE | null;
  profileError?: { message: string };
  targetsError?: { message: string };
}) {
  const insert = vi.fn<
    (payload: Record<string, unknown>) => Promise<{
      error: { message: string } | null;
    }>
  >(() => Promise.resolve({ error: options?.targetsError ?? null }));
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options && "profile" in options ? options.profile : PROFILE,
    error: options?.profileError ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select };
    if (table === "targets") return { insert };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, insert, select } as unknown as {
    from: typeof from;
    insert: typeof insert;
    select: typeof select;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (m: ReturnType<typeof makeMockSupabase>) => m as any;

describe("updateGoal: server-side re-validation", () => {
  it("rejects an invalid goal type before touching the database", async () => {
    const supabase = makeMockSupabase();
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: null, targetWeightKg: null, timeframeWeeks: null },
      NOW
    );
    expect(result.ok).toBe(false);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rejects a lose goal without a target weight before writing", async () => {
    const supabase = makeMockSupabase();
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "lose", targetWeightKg: null, timeframeWeeks: null },
      NOW
    );
    expect(result.ok).toBe(false);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("rejects a gain target that is not above the current weight", async () => {
    const supabase = makeMockSupabase();
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "gain", targetWeightKg: 80, timeframeWeeks: 12 }, // 80 < 85
      NOW
    );
    expect(result.ok).toBe(false);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("errors when the profile is incomplete", async () => {
    const supabase = makeMockSupabase({ profile: null });
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "maintain", targetWeightKg: null, timeframeWeeks: null },
      NOW
    );
    expect(result.ok).toBe(false);
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});

describe("updateGoal: recompute + write shape", () => {
  it("inserts a fresh maintenance targets row (no target weight/timeframe)", async () => {
    const supabase = makeMockSupabase();
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "maintain", targetWeightKg: null, timeframeWeeks: null },
      NOW
    );

    expect(result.ok).toBe(true);
    const payload = supabase.insert.mock.calls[0][0];
    expect(payload.user_id).toBe("user-1");
    expect(payload.goal).toBe("maintain");
    expect(payload.goal_weight_kg).toBeNull();
    expect(payload.timeframe_weeks).toBeNull();
    expect(payload.daily_kcal as number).toBeGreaterThan(0);
    expect(payload.protein_g as number).toBeGreaterThan(0);
    if (result.ok) expect(result.plan.dailyKcal).toBeGreaterThan(0);
  });

  it("inserts a gain targets row carrying the target weight + timeframe", async () => {
    const supabase = makeMockSupabase();
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "gain", targetWeightKg: 92, timeframeWeeks: 16 },
      NOW
    );

    expect(result.ok).toBe(true);
    const payload = supabase.insert.mock.calls[0][0];
    expect(payload.goal).toBe("gain");
    expect(payload.goal_weight_kg).toBe(92);
    expect(payload.timeframe_weeks).toBe(16);
  });

  it("surfaces a save error when the targets insert fails", async () => {
    const supabase = makeMockSupabase({ targetsError: { message: "boom" } });
    const result = await updateGoal(
      asClient(supabase),
      "user-1",
      { goal: "maintain", targetWeightKg: null, timeframeWeeks: null },
      NOW
    );
    expect(result.ok).toBe(false);
  });
});
