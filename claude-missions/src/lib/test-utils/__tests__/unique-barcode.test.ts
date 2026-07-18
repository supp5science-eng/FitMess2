import { describe, expect, it } from "vitest";

import { uniqueTestBarcode } from "../unique-barcode";

// F031a: unit coverage for the collision-safe test-barcode generator that
// replaces the truncated `Date.now()`-based fixture pattern responsible for
// recurring `foods.barcode` unique-constraint collisions across
// live-integration test files (see missions/20260717-183157/handoffs/F031a-handoff.md).

describe("uniqueTestBarcode: collision-safe 13-digit foods.barcode test fixture", () => {
  it("test_AS_004_returns_a_13_digit_numeric_string", () => {
    const barcode = uniqueTestBarcode();
    expect(barcode).toMatch(/^\d{13}$/);
  });

  it("test_AS_004_always_starts_with_the_reserved_9_test_prefix", () => {
    for (let i = 0; i < 50; i++) {
      expect(uniqueTestBarcode().startsWith("9")).toBe(true);
    }
  });

  it("test_AS_004_never_repeats_across_a_large_number_of_consecutive_calls", () => {
    const seen = new Set<string>();
    const count = 20_000;
    for (let i = 0; i < count; i++) {
      seen.add(uniqueTestBarcode());
    }
    // Every call must be unique -- the whole point of the generator is
    // that no two calls (even back-to-back, even across "runs" simulated
    // by re-importing/re-calling many times) ever collide.
    expect(seen.size).toBe(count);
  });

  it("test_AS_004_does_not_truncate_away_its_entropy_the_way_the_old_Date_now_based_pattern_did", () => {
    // The bug this generator fixes: `${prefix}${Date.now()}-${random}`.slice(0, 13)
    // kept only a prefix of the millisecond timestamp and dropped the
    // random component entirely, so the "barcode" only changed roughly
    // once every 10 seconds. Prove the fixed generator instead changes on
    // EVERY call, not just once per timing window.
    const first = uniqueTestBarcode();
    const second = uniqueTestBarcode();
    expect(first).not.toBe(second);
  });

  it("test_AS_004_is_well_formed_even_for_the_first_call_after_module_load", () => {
    // Regression guard: the counter's initial random seed must itself be
    // zero-padded to 6 digits (not left short), otherwise the very first
    // barcodes generated in a fresh process could be fewer than 13 digits.
    const barcode = uniqueTestBarcode();
    expect(barcode).toHaveLength(13);
  });
});
