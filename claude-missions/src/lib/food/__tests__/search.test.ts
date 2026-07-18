import { describe, expect, it } from "vitest";

import {
  MAX_SEARCH_RESULTS,
  normalizeSearchQuery,
  searchQuerySchema,
} from "@/lib/food/search";

// F023: pure-logic unit coverage for the query-normalization/validation
// helpers behind `GET /api/foods/search`. The live-DB proof of AS-036/
// AS-037/AS-038 (does the search actually FIND the right food) lives in
// `src/app/api/foods/search/__tests__/route.integration.test.ts` -- this
// file only proves the deterministic, DB-free steps: Cyrillic gets
// transliterated before it ever reaches the query (AS-037's precondition),
// Latin passes through unchanged (AS-036's precondition), and malformed
// input is rejected per the clarified "zod-validated inputs; reject
// malformed with 400 + Serbian message" answer.

describe("F023: normalizeSearchQuery", () => {
  it("test_AS_036_latin_query_passes_through_unchanged", () => {
    expect(normalizeSearchQuery("Plazma")).toBe("Plazma");
    expect(normalizeSearchQuery("sarma")).toBe("sarma");
  });

  it("test_AS_037_cyrillic_query_is_transliterated_to_latin", () => {
    expect(normalizeSearchQuery("Плазма")).toBe("Plazma");
    expect(normalizeSearchQuery("сарма")).toBe("sarma");
  });

  it("test_normalizeSearchQuery_trims_leading_and_trailing_whitespace", () => {
    expect(normalizeSearchQuery("  Plazma  ")).toBe("Plazma");
    expect(normalizeSearchQuery("  Плазма ")).toBe("Plazma");
  });
});

describe("F023: searchQuerySchema (zod validation)", () => {
  it("test_validation_accepts_a_normal_latin_query", () => {
    const result = searchQuerySchema.safeParse("sarma");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("sarma");
  });

  it("test_validation_accepts_a_cyrillic_query_untranslated_at_this_stage", () => {
    // Validation only checks shape/length -- transliteration is a separate
    // step (normalizeSearchQuery), applied downstream in searchFoods().
    const result = searchQuerySchema.safeParse("сарма");
    expect(result.success).toBe(true);
  });

  it("test_validation_rejects_an_empty_string_with_a_serbian_message", () => {
    const result = searchQuerySchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.message).not.toMatch(/error|exception/i);
    }
  });

  it("test_validation_rejects_a_whitespace_only_string", () => {
    const result = searchQuerySchema.safeParse("   ");
    expect(result.success).toBe(false);
  });

  it("test_validation_rejects_a_query_longer_than_100_characters", () => {
    const tooLong = "a".repeat(101);
    const result = searchQuerySchema.safeParse(tooLong);
    expect(result.success).toBe(false);
  });

  it("test_validation_accepts_a_query_at_exactly_the_100_character_boundary", () => {
    const atLimit = "a".repeat(100);
    const result = searchQuerySchema.safeParse(atLimit);
    expect(result.success).toBe(true);
  });

  it("test_validation_rejects_non_string_input", () => {
    const result = searchQuerySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe("F023: MAX_SEARCH_RESULTS", () => {
  it("test_search_results_are_bounded", () => {
    expect(MAX_SEARCH_RESULTS).toBeGreaterThan(0);
    expect(MAX_SEARCH_RESULTS).toBeLessThanOrEqual(50);
  });
});
