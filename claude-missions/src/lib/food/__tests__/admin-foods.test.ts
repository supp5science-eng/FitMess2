import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  adminFoodInputSchema,
  createVerifiedFood,
  getFoodStats,
  searchAllFoods,
  updateFood,
} from "@/lib/food/admin-foods";
import type { Database } from "@/lib/types/db";

// F035: unit tests for the admin food lib. A tiny chainable fake stands in for
// the Supabase query builder so the create/update/search/stats decision logic
// is exercised without any live I/O (the routes that wrap these are thin and
// their admin-gate is proven in src/lib/auth's admin tests).

interface FakeResult {
  data?: unknown;
  error?: unknown;
  count?: number;
}

function makeFakeAdmin(queue: FakeResult[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  let index = 0;

  function makeChain(result: FakeResult) {
    const chain: Record<string, unknown> = {};
    for (const method of ["insert", "update", "select", "eq", "or", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    }
    chain.single = () => Promise.resolve(result);
    chain.maybeSingle = () => Promise.resolve(result);
    // Awaiting the builder itself (getFoodStats' count query) resolves here.
    chain.then = (onF: (v: FakeResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR);
    return chain;
  }

  const admin = {
    from: (...args: unknown[]) => {
      calls.push({ method: "from", args });
      const result = queue[index] ?? {};
      index += 1;
      return makeChain(result);
    },
  } as unknown as SupabaseClient<Database>;

  return { admin, calls };
}

const VALID_INPUT = {
  name_sr: "Jogurt 2.8% m.m.",
  brand: "Imlek",
  barcode: "8600000000017",
  kcal_100g: 62,
  protein_100g: 3.2,
  carbs_100g: 4.7,
  fat_100g: 2.8,
  common_units: [{ label: "čaša", grams: 200 }],
};

describe("F035: adminFoodInputSchema", () => {
  it("accepts a valid food with common_units", () => {
    const parsed = adminFoodInputSchema.safeParse(VALID_INPUT);
    expect(parsed.success).toBe(true);
  });

  it("defaults common_units to an empty array when omitted", () => {
    const { common_units, ...withoutUnits } = VALID_INPUT;
    void common_units;
    const parsed = adminFoodInputSchema.safeParse(withoutUnits);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.common_units).toEqual([]);
  });

  it("rejects a common_unit with zero/negative grams", () => {
    const parsed = adminFoodInputSchema.safeParse({
      ...VALID_INPUT,
      common_units: [{ label: "kriška", grams: 0 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a common_unit with a blank label", () => {
    const parsed = adminFoodInputSchema.safeParse({
      ...VALID_INPUT,
      common_units: [{ label: "   ", grams: 30 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const parsed = adminFoodInputSchema.safeParse({ ...VALID_INPUT, name_sr: "" });
    expect(parsed.success).toBe(false);
  });
});

describe("F035: createVerifiedFood", () => {
  it("inserts as verified/seed with no submitter and returns the row", async () => {
    const created = { id: "food-1", ...VALID_INPUT };
    const { admin, calls } = makeFakeAdmin([{ data: created, error: null }]);

    const result = await createVerifiedFood(admin, VALID_INPUT);

    expect(result.ok).toBe(true);
    const insert = calls.find((c) => c.method === "insert");
    expect(insert).toBeDefined();
    const payload = insert!.args[0] as Record<string, unknown>;
    expect(payload.verified).toBe(true);
    expect(payload.source).toBe("seed");
    expect(payload.submitted_by).toBeNull();
    expect(payload.common_units).toEqual([{ label: "čaša", grams: 200 }]);
  });

  it("returns a 400 for an invalid payload without touching the DB", async () => {
    const { admin, calls } = makeFakeAdmin([]);
    const result = await createVerifiedFood(admin, { name_sr: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("maps a duplicate-barcode (23505) to 409 with the existing food id", async () => {
    const { admin } = makeFakeAdmin([
      { data: null, error: { code: "23505" } },
      { data: { id: "existing-9" } },
    ]);
    const result = await createVerifiedFood(admin, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.existingFoodId).toBe("existing-9");
    }
  });
});

describe("F035: updateFood", () => {
  it("returns 404 when the food does not exist", async () => {
    const { admin } = makeFakeAdmin([{ data: null, error: null }]);
    const result = await updateFood(admin, "missing", VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("does not send verified or is_removed in the update payload", async () => {
    const { admin, calls } = makeFakeAdmin([
      { data: { id: "food-1", ...VALID_INPUT }, error: null },
    ]);
    await updateFood(admin, "food-1", VALID_INPUT);
    const update = calls.find((c) => c.method === "update");
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("verified");
    expect(payload).not.toHaveProperty("is_removed");
  });
});

describe("F035: searchAllFoods", () => {
  it("returns an empty list for a blank query without querying", async () => {
    const { admin, calls } = makeFakeAdmin([]);
    const result = await searchAllFoods(admin, "   ");
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
    expect(calls.length).toBe(0);
  });

  it("searches name, brand and barcode for a real query", async () => {
    const { admin, calls } = makeFakeAdmin([
      { data: [{ id: "food-1" }], error: null },
    ]);
    const result = await searchAllFoods(admin, "jogurt");
    expect(result.data).toEqual([{ id: "food-1" }]);
    const or = calls.find((c) => c.method === "or");
    const filter = String(or!.args[0]);
    expect(filter).toContain("name_sr.ilike");
    expect(filter).toContain("brand.ilike");
    expect(filter).toContain("barcode.ilike");
  });
});

describe("F035: getFoodStats", () => {
  it("derives unverified as total minus verified and shapes the source split", async () => {
    // Query order in getFoodStats: total, verified, removed, seed, off, user.
    const { admin } = makeFakeAdmin([
      { count: 100 },
      { count: 60 },
      { count: 5 },
      { count: 40 },
      { count: 0 },
      { count: 20 },
    ]);
    const stats = await getFoodStats(admin);
    expect(stats).toEqual({
      total: 100,
      verified: 60,
      unverified: 40,
      removed: 5,
      bySource: { seed: 40, off: 0, user: 20 },
    });
  });
});
