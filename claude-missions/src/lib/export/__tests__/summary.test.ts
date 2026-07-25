import { describe, expect, it, vi } from "vitest";

import { collectExportSummary, formatMemberSince } from "../summary";

// The counts behind `/profil/moji-podaci` -- the screen that tells a user what
// is stored about them before offering the download.

function makeMockSupabase(options?: {
  createdAt?: string | null;
  /** Per-table `{count}` or `{error}` overrides. */
  tables?: Record<string, { count?: number; error?: { message: string } }>;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data:
      options?.createdAt === null
        ? null
        : { created_at: options?.createdAt ?? "2026-07-17T10:00:00.000Z" },
    error: null,
  });

  const eqCalls: [string, string, string][] = [];
  const headFlags: Record<string, boolean> = {};

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }),
      };
    }

    const override = options?.tables?.[table];
    return {
      select: (_columns: string, opts?: { head?: boolean; count?: string }) => {
        headFlags[table] = Boolean(opts?.head);
        return {
          eq: (column: string, value: string) => {
            eqCalls.push([table, column, value]);
            return Promise.resolve({
              count: override?.error ? null : override?.count ?? 0,
              error: override?.error ?? null,
            });
          },
        };
      },
    };
  });

  return { from, eqCalls, headFlags } as unknown as {
    from: typeof from;
    eqCalls: typeof eqCalls;
    headFlags: typeof headFlags;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (supabase: ReturnType<typeof makeMockSupabase>, email = "a@b.rs") =>
  collectExportSummary(supabase as any, "user-1", email);
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("collectExportSummary", () => {
  it("test_returns_one_row_per_counted_category_in_display_order", async () => {
    const summary = await run(
      makeMockSupabase({
        tables: {
          logs: { count: 342 },
          weigh_ins: { count: 18 },
          water_intake: { count: 26 },
          habit_checks: { count: 54 },
        },
      })
    );

    expect(summary.rows.map((row) => row.key)).toEqual([
      "logs",
      "weighIns",
      "waterIntake",
      "stepCounts",
      "habitChecks",
      "mealPhotos",
      "targets",
    ]);
    expect(summary.rows[0]).toMatchObject({ labelSr: "Unosi hrane", count: 342 });
    expect(summary.rows[1].count).toBe(18);
    expect(summary.rows[4].count).toBe(54);
  });

  it("test_counts_are_head_only_so_no_rows_are_transferred", async () => {
    // A user with thousands of logs must not pay for downloading them just to
    // see the number.
    const supabase = makeMockSupabase();
    await run(supabase);

    expect(supabase.headFlags.logs).toBe(true);
  });

  it("test_every_count_is_scoped_to_the_given_user", async () => {
    const supabase = makeMockSupabase();
    await run(supabase);

    for (const [, column, value] of supabase.eqCalls) {
      expect(column).toBe("user_id");
      expect(value).toBe("user-1");
    }
  });

  it("test_an_unreadable_table_is_null_not_zero", async () => {
    // "We have none of these" and "we could not check" are different claims;
    // the screen renders null as "—".
    const summary = await run(
      makeMockSupabase({
        tables: { habit_checks: { error: { message: "relation does not exist" } } },
      })
    );

    const habits = summary.rows.find((row) => row.key === "habitChecks");
    expect(habits?.count).toBeNull();
    // The rest still resolves.
    expect(summary.rows.find((row) => row.key === "logs")?.count).toBe(0);
  });

  it("test_a_missing_profile_row_leaves_member_since_null_rather_than_failing", async () => {
    const summary = await run(makeMockSupabase({ createdAt: null }));
    expect(summary.memberSince).toBeNull();
    expect(summary.rows).not.toHaveLength(0);
  });

  it("test_the_account_email_is_passed_through", async () => {
    const summary = await run(makeMockSupabase(), "marko@fitmess.app");
    expect(summary.email).toBe("marko@fitmess.app");
  });
});

describe("formatMemberSince", () => {
  it("test_formats_an_iso_timestamp_as_a_serbian_date", () => {
    expect(formatMemberSince("2026-07-17T10:00:00.000Z")).toMatch(/2026/);
    expect(formatMemberSince("2026-07-17T10:00:00.000Z")).toMatch(/jul/i);
  });

  it("test_returns_null_for_missing_or_unparsable_input", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince("not-a-date")).toBeNull();
  });
});
