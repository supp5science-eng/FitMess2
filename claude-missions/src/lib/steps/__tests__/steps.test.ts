import { describe, expect, it, vi } from "vitest";

import { getStepsForDay } from "@/lib/steps/steps";
import type { Database } from "@/lib/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal Supabase mock for the `.from("step_counts").select("steps")
// .eq(...).eq(...).maybeSingle()` chain getStepsForDay uses.
function makeClient(result: {
  data: { steps: number } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eqDay = vi.fn(() => ({ maybeSingle }));
  const eqUser = vi.fn(() => ({ eq: eqDay }));
  const select = vi.fn(() => ({ eq: eqUser }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    spies: { from, select, eqUser, eqDay, maybeSingle },
  };
}

describe("getStepsForDay", () => {
  it("returns the stored steps for a day that has a row", async () => {
    const { client, spies } = makeClient({ data: { steps: 7240 }, error: null });

    const result = await getStepsForDay(client, "user-1", "2026-07-22");

    expect(result).toEqual({ steps: 7240, error: null });
    expect(spies.from).toHaveBeenCalledWith("step_counts");
    expect(spies.eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(spies.eqDay).toHaveBeenCalledWith("day", "2026-07-22");
  });

  it("resolves to 0 (not an error) for a day with no row yet", async () => {
    const { client } = makeClient({ data: null, error: null });

    const result = await getStepsForDay(client, "user-1", "2026-07-22");

    expect(result).toEqual({ steps: 0, error: null });
  });

  it("surfaces a read error and defaults steps to 0", async () => {
    const { client } = makeClient({ data: null, error: { message: "boom" } });

    const result = await getStepsForDay(client, "user-1", "2026-07-22");

    expect(result).toEqual({ steps: 0, error: { message: "boom" } });
  });
});
