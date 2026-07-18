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

function makeMockSupabase(options?: {
  profile?: Record<string, unknown> | null;
  profileError?: { message: string };
  targets?: Record<string, unknown>[] | null;
  targetsError?: { message: string };
}) {
  const profileMaybeSingle = vi
    .fn()
    .mockResolvedValue({
      data: options?.profile === undefined ? PROFILE_ROW : options.profile,
      error: options?.profileError ?? null,
    });
  const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  const targetsEq = vi.fn().mockResolvedValue({
    data: options?.targets === undefined ? TARGET_ROWS : options.targets,
    error: options?.targetsError ?? null,
  });
  const targetsSelect = vi.fn(() => ({ eq: targetsEq }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect };
    if (table === "targets") return { select: targetsSelect };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return { from, profileEq, targetsEq } as unknown as {
    from: typeof from;
    profileEq: typeof profileEq;
    targetsEq: typeof targetsEq;
  };
}

describe("collectUserExport: AS-014 -- builds a complete own-data export", () => {
  it("test_AS_014_includes_profile_targets_rules_exported_at_and_schema_note", async () => {
    const supabase = makeMockSupabase();

    const result = await collectUserExport(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      { id: "user-1", email: "korisnik@example.com" }
    );

    expect(result.account).toEqual({ id: "user-1", email: "korisnik@example.com" });
    expect(result.profile).toMatchObject({ user_id: "user-1", sex: "female" });
    expect(result.rules).toEqual(RULES);
    expect(result.targets).toEqual(TARGET_ROWS);
    expect(typeof result.exported_at).toBe("string");
    expect(() => new Date(result.exported_at).toISOString()).not.toThrow();
    expect(typeof result.schema_note).toBe("string");
    expect(result.schema_note.length).toBeGreaterThan(0);
  });

  it("test_AS_014_schema_note_lists_every_currently_included_data_category", async () => {
    const supabase = makeMockSupabase();

    const result = await collectUserExport(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      { id: "user-1", email: null }
    );

    expect(result.schema_note).toMatch(/profil/i);
    expect(result.schema_note).toMatch(/pravila ishrane/i);
    expect(result.schema_note).toMatch(/ciljevi ishrane/i);
  });

  it("test_AS_014_rules_are_not_duplicated_inside_the_profile_object", async () => {
    const supabase = makeMockSupabase();

    const result = await collectUserExport(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      { id: "user-1", email: null }
    );

    expect(result.profile).not.toHaveProperty("rules");
  });

  it("test_AS_014_queries_are_scoped_to_the_given_user_id_defense_in_depth", async () => {
    const supabase = makeMockSupabase();

    await collectUserExport(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      { id: "user-1", email: null }
    );

    expect(supabase.profileEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase.targetsEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("test_AS_014_a_user_with_no_profile_row_yet_gets_a_null_profile_and_empty_rules_not_an_error", async () => {
    const supabase = makeMockSupabase({ profile: null, targets: [] });

    const result = await collectUserExport(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      { id: "user-1", email: null }
    );

    expect(result.profile).toBeNull();
    expect(result.rules).toEqual([]);
    expect(result.targets).toEqual([]);
  });

  it("test_AS_014_a_profile_read_failure_throws_instead_of_returning_a_partial_export", async () => {
    const supabase = makeMockSupabase({ profileError: { message: "db unreachable" } });

    await expect(
      collectUserExport(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        { id: "user-1", email: null }
      )
    ).rejects.toBeInstanceOf(ExportReadError);
  });

  it("test_AS_014_a_targets_read_failure_throws_instead_of_returning_a_partial_export", async () => {
    const supabase = makeMockSupabase({ targetsError: { message: "db unreachable" } });

    await expect(
      collectUserExport(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        { id: "user-1", email: null }
      )
    ).rejects.toBeInstanceOf(ExportReadError);
  });

  it("test_AS_014_a_read_error_message_never_leaks_the_raw_db_error_text", async () => {
    const supabase = makeMockSupabase({ profileError: { message: "SUPER SECRET DB DETAIL" } });

    try {
      await collectUserExport(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        { id: "user-1", email: null }
      );
      throw new Error("expected collectUserExport to throw");
    } catch (err) {
      // The thrown error is an internal ExportReadError for the route
      // handler's catch block to log server-side; the ROUTE never forwards
      // this message to the client (see route.integration.test.ts) -- this
      // test only pins that the error type is right so that contract holds.
      expect(err).toBeInstanceOf(ExportReadError);
    }
  });
});
