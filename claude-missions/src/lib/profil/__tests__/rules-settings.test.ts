import { describe, expect, it, vi } from "vitest";

import { regenerateRules, updateRules } from "../rules-settings";
import type { PersistedRule } from "@/lib/budget/rules";

// F017: unit coverage for `updateRules`/`regenerateRules`'s validation +
// write shape (AS-029), using a mock Supabase client -- the live round-trip
// against a real project is covered by
// `src/app/(app)/profil/pravila/__tests__/actions.integration.test.ts`.

const VALID_RULES: PersistedRule[] = [
  { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka svaki dan.", enabled: true },
  { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: false },
];

function makeUpdateMockSupabase(options?: { error?: { message: string } }) {
  const eq = vi.fn().mockResolvedValue({ error: options?.error ?? null });
  const update = vi.fn<(payload: Record<string, unknown>) => { eq: typeof eq }>(
    () => ({ eq })
  );
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, update, eq } as unknown as {
    from: typeof from;
    update: typeof update;
    eq: typeof eq;
  };
}

describe("updateRules: AS-029 -- re-validates before writing", () => {
  it("test_AS_029_a_well_formed_array_is_written_to_profiles_rules_for_the_given_user", async () => {
    const supabase = makeUpdateMockSupabase();
    const result = await updateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      VALID_RULES
    );

    expect(result.ok).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    const payload = supabase.update.mock.calls[0][0] as { rules: PersistedRule[] };
    expect(payload.rules).toEqual(VALID_RULES);
    expect(supabase.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("test_AS_029_rejects_a_malformed_rule_before_writing_anything", async () => {
    const supabase = makeUpdateMockSupabase();
    const malformed = [{ id: "x", textSr: "", enabled: true }] as PersistedRule[];

    const result = await updateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      malformed
    );

    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("test_AS_029_a_db_error_is_surfaced_as_a_serbian_message", async () => {
    const supabase = makeUpdateMockSupabase({ error: { message: "db unreachable" } });
    const result = await updateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1",
      VALID_RULES
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_sr.length).toBeGreaterThan(0);
      expect(result.error_sr).not.toMatch(/db unreachable/);
    }
  });
});

function makeRegenerateMockSupabase(options: {
  profile?: Record<string, unknown> | null;
  profileError?: { message: string };
  target?: Record<string, unknown> | null;
  targetError?: { message: string };
  updateError?: { message: string };
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const update = vi.fn(() => ({ eq: updateEq }));

  const profileMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: options.profile ?? null, error: options.profileError ?? null });
  const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  const targetMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: options.target ?? null, error: options.targetError ?? null });
  const targetLimit = vi.fn(() => ({ maybeSingle: targetMaybeSingle }));
  const targetOrder = vi.fn(() => ({ limit: targetLimit }));
  const targetEq = vi.fn(() => ({ order: targetOrder }));
  const targetSelect = vi.fn(() => ({ eq: targetEq }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect, update };
    if (table === "targets") return { select: targetSelect };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, update, updateEq } as unknown as {
    from: typeof from;
    update: typeof update;
    updateEq: typeof updateEq;
  };
}

const VALID_PROFILE = {
  sex: "female",
  birth_year: 1996,
  height_cm: 168,
  weight_kg: 80,
  activity_level: "moderate",
};

const VALID_TARGET = {
  goal_weight_kg: 74,
  timeframe_weeks: 12,
};

describe("regenerateRules: AS-029 empty-state / refresh action", () => {
  it("test_AS_029_regenerates_between_3_and_5_rules_from_the_users_profile_and_latest_target", async () => {
    const supabase = makeRegenerateMockSupabase({
      profile: VALID_PROFILE,
      target: VALID_TARGET,
    });

    const result = await regenerateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rules.length).toBeGreaterThanOrEqual(3);
      expect(result.rules.length).toBeLessThanOrEqual(5);
      for (const rule of result.rules) {
        expect(rule.enabled).toBe(true);
      }
    }
    expect(supabase.update).toHaveBeenCalled();
  });

  it("test_AS_029_returns_a_serbian_error_when_the_profile_is_incomplete", async () => {
    const supabase = makeRegenerateMockSupabase({
      profile: { ...VALID_PROFILE, sex: null },
      target: VALID_TARGET,
    });

    const result = await regenerateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_sr.length).toBeGreaterThan(0);
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("test_AS_029_returns_a_serbian_error_when_there_is_no_target_row_yet", async () => {
    const supabase = makeRegenerateMockSupabase({
      profile: VALID_PROFILE,
      target: null,
    });

    const result = await regenerateRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "user-1"
    );

    expect(result.ok).toBe(false);
    expect(supabase.update).not.toHaveBeenCalled();
  });
});
