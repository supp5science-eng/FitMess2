import { describe, expect, it, vi } from "vitest";

import { getTodayData } from "@/lib/home/today";
import type { DayRange } from "@/lib/home/today-range";

// `getTodayData` is the home screen's critical read. Its only other coverage
// (`today.integration.test.ts`) needs live Supabase credentials and self-skips
// without them, so these doubles-based tests lock the parts that MUST hold
// regardless of environment -- above all that `foods` and `meal_photos`, which
// both derive from `logs` alone, are fetched CONCURRENTLY rather than one after
// the other (the day read is two serial round trips, not three).

const RANGE: DayRange = {
  startIso: "2026-07-30T00:00:00.000Z",
  endIsoExclusive: "2026-07-31T00:00:00.000Z",
};

const TARGET_ROW = { id: "t1", user_id: "u1", daily_kcal: 2000, goal: "lose" };
const LOG_ROWS = [
  { id: "l1", user_id: "u1", food_id: "f1", kcal: 500, logged_at: RANGE.startIso },
  { id: "l2", user_id: "u1", food_id: "f2", kcal: 300, logged_at: RANGE.startIso },
];
const FOOD_ROWS = [
  { id: "f1", name: "Jaje" },
  { id: "f2", name: "Hleb" },
];

/**
 * A Supabase double whose `foods` / `meal_photos` reads resolve only when
 * `release()` is called, so a test can prove BOTH were started before EITHER
 * finished -- the actual definition of "these run concurrently".
 */
function makeSupabase(options?: {
  foodsError?: { message: string };
  photosRejects?: boolean;
  photoRows?: { log_id: string }[];
}) {
  const started: string[] = [];
  const gates: (() => void)[] = [];
  // Once opened, the gate STAYS open: a read error makes `getTodayData` retry
  // the whole attempt (its documented cold-start retry loop), and those later
  // attempts must settle too or the test would hang waiting on a gate nobody
  // reopens.
  let opened = false;

  /** Lets every gated (foods/photos) read settle, now and for any retry. */
  const release = () => {
    opened = true;
    gates.splice(0).forEach((fn) => fn());
  };

  /** A promise that settles only once the gate is open. Built so a rejection is
   * created lazily INSIDE the gate -- constructing `Promise.reject` eagerly
   * would surface as an unhandled rejection before the code under test can
   * attach its handler. */
  function gated<T>(value: T, mode: "resolve" | "reject" = "resolve"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const settle = () =>
        mode === "reject"
          ? reject(new Error("meal_photos missing"))
          : resolve(value);
      if (opened) settle();
      else gates.push(settle);
    });
  }

  const from = vi.fn((table: string) => {
    started.push(table);

    if (table === "targets") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                abortSignal: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: TARGET_ROW, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "logs") {
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lt: () => ({
                order: () => ({
                  abortSignal: () =>
                    Promise.resolve({ data: LOG_ROWS, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "foods") {
      return {
        select: () => ({
          in: () => ({
            abortSignal: () =>
              gated({
                data: options?.foodsError ? null : FOOD_ROWS,
                error: options?.foodsError ?? null,
              }),
          }),
        }),
      };
    }

    if (table === "meal_photos") {
      return {
        select: () => ({
          in: () => ({
            abortSignal: () =>
              gated(
                {
                  data: options?.photoRows ?? [{ log_id: "l1" }],
                  error: null,
                },
                options?.photosRejects ? "reject" : "resolve"
              ),
          }),
        }),
      };
    }

    throw new Error(`unexpected table in test double: ${table}`);
  });

  /** Yields to the event loop until both gated reads are in flight, then lets
   * them settle. Deterministic: it waits on the double's own `started` log
   * rather than on a fixed timeout. */
  async function releaseWhenBothStarted(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      if (started.includes("foods") && started.includes("meal_photos")) break;
      await new Promise((r) => setTimeout(r, 0));
    }
    release();
  }

  return { client: { from } as never, started, release, releaseWhenBothStarted };
}

describe("getTodayData: round-trip shape", () => {
  it("test_foods_and_meal_photos_are_read_concurrently_not_serially", async () => {
    const { client, started, release } = makeSupabase();

    const pending = getTodayData(client, "u1", RANGE);
    // Let the targets+logs stage settle, but keep foods/photos gated shut.
    for (let i = 0; i < 200; i++) {
      if (started.includes("foods") && started.includes("meal_photos")) break;
      await new Promise((r) => setTimeout(r, 0));
    }

    // BOTH reads are in flight while NEITHER has resolved. Serial code could
    // never reach this state -- `meal_photos` would not have started until
    // `foods` had already returned.
    expect(started).toEqual(["targets", "logs", "foods", "meal_photos"]);

    release();
    const result = await pending;
    expect(result.error).toBeNull();
    expect(result.data?.logs).toHaveLength(2);
  });

  it("test_a_failed_foods_read_still_fails_the_day_read", async () => {
    const { client, releaseWhenBothStarted } = makeSupabase({
      foodsError: { message: "foods exploded" },
    });
    const pending = getTodayData(client, "u1", RANGE);
    await releaseWhenBothStarted();
    const result = await pending;
    // foods is critical: a log cannot render without its food.
    expect(result.error?.message).toBe("foods exploded");
    expect(result.data).toBeNull();
    // Generous timeout: a persistent read error deliberately spends
    // `getTodayData`'s whole ~4s cold-start retry budget before giving up.
  }, 15_000);

  it("test_a_rejected_meal_photos_read_degrades_to_no_photos", async () => {
    const { client, releaseWhenBothStarted } = makeSupabase({
      photosRejects: true,
    });
    const pending = getTodayData(client, "u1", RANGE);
    await releaseWhenBothStarted();
    const result = await pending;
    // Photos are a best-effort enhancement -- a missing table (or any rejection)
    // must never take down the core day read, and must not reject the
    // Promise.all that now runs it alongside foods.
    expect(result.error).toBeNull();
    expect(result.data?.logs).toHaveLength(2);
    expect(result.data?.logs.every((log) => !log.hasPhoto)).toBe(true);
  });

  it("test_a_stored_photo_is_flagged_on_its_own_log", async () => {
    const { client, releaseWhenBothStarted } = makeSupabase({
      photoRows: [{ log_id: "l2" }],
    });
    const pending = getTodayData(client, "u1", RANGE);
    await releaseWhenBothStarted();
    const result = await pending;
    const byId = new Map(result.data!.logs.map((log) => [log.id, log]));
    expect(byId.get("l2")?.hasPhoto).toBe(true);
    expect(byId.get("l1")?.hasPhoto).toBe(false);
  });
});
