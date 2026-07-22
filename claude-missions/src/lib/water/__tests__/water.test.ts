import { describe, expect, it, vi } from "vitest";

import { getWaterMl } from "@/lib/water/water";
import type { Database } from "@/lib/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Builds a minimal Supabase mock for the `.from("water_intake").select("ml")
// .eq(...).eq(...).maybeSingle()` chain getWaterMl uses.
function makeClient(result: {
  data: { ml: number } | null;
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

describe("getWaterMl", () => {
  it("returns the stored ml for a day that has a row", async () => {
    const { client, spies } = makeClient({ data: { ml: 1250 }, error: null });

    const result = await getWaterMl(client, "user-1", "2026-07-22");

    expect(result).toEqual({ ml: 1250, error: null });
    expect(spies.from).toHaveBeenCalledWith("water_intake");
    expect(spies.eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(spies.eqDay).toHaveBeenCalledWith("day", "2026-07-22");
  });

  it("resolves to 0 (not an error) for a day with no row yet", async () => {
    const { client } = makeClient({ data: null, error: null });

    const result = await getWaterMl(client, "user-1", "2026-07-22");

    expect(result).toEqual({ ml: 0, error: null });
  });

  it("surfaces a read error and defaults ml to 0", async () => {
    const { client } = makeClient({
      data: null,
      error: { message: "boom" },
    });

    const result = await getWaterMl(client, "user-1", "2026-07-22");

    expect(result).toEqual({ ml: 0, error: { message: "boom" } });
  });
});
