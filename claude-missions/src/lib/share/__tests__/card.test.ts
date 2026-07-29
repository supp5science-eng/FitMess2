import { describe, expect, it } from "vitest";

import {
  CARD_BASE_GLYPHS,
  CARD_FORMATS,
  MACRO_COLORS,
  MAX_DISH_NAME,
  cardFontText,
  cardMacros,
  cleanDishName,
  formatGrams,
  formatKcal,
  toCardFormat,
} from "@/lib/share/card";

// "Money-math" rule: every string/number the card paints is shaped by a pure
// function here, so the `next/og` template stays a dumb renderer.

describe("card formats", () => {
  it("test_story_is_9x16_and_post_is_1x1_at_1080", () => {
    expect(CARD_FORMATS.story).toEqual({ width: 1080, height: 1920 });
    expect(CARD_FORMATS.post).toEqual({ width: 1080, height: 1080 });
  });

  it("test_toCardFormat_defaults_to_the_primary_story", () => {
    expect(toCardFormat("story")).toBe("story");
    expect(toCardFormat("post")).toBe("post");
    expect(toCardFormat(null)).toBe("story");
    expect(toCardFormat(undefined)).toBe("story");
    expect(toCardFormat("garbage")).toBe("story");
  });
});

describe("formatKcal / formatGrams", () => {
  it("test_kcal_is_a_whole_non_negative_number", () => {
    expect(formatKcal(642.4)).toBe("642");
    expect(formatKcal(642.6)).toBe("643");
    expect(formatKcal(-10)).toBe("0");
  });

  it("test_grams_carry_a_unit_and_never_go_negative", () => {
    expect(formatGrams(41.6)).toBe("42 g");
    expect(formatGrams(0)).toBe("0 g");
    expect(formatGrams(-3)).toBe("0 g");
  });
});

describe("cardMacros", () => {
  it("test_returns_P_UH_M_in_order_with_the_app_macro_colours", () => {
    const macros = cardMacros(30.2, 55.8, 12.4);
    expect(macros.map((m) => m.label)).toEqual([
      "PROTEIN",
      "UGLJENI H.",
      "MAST",
    ]);
    expect(macros.map((m) => m.grams)).toEqual([30, 56, 12]);
    expect(macros.map((m) => m.color)).toEqual([
      MACRO_COLORS.protein,
      MACRO_COLORS.carbs,
      MACRO_COLORS.fat,
    ]);
  });

  it("test_clamps_negative_macros_to_zero", () => {
    expect(cardMacros(-1, -2, -3).map((m) => m.grams)).toEqual([0, 0, 0]);
  });
});

describe("cleanDishName", () => {
  it("test_collapses_whitespace_and_trims", () => {
    expect(cleanDishName("  Ćevapi   sa   lukom  ")).toBe("Ćevapi sa lukom");
  });

  it("test_falls_back_to_a_calm_generic_when_empty", () => {
    expect(cleanDishName("   ")).toBe("Obrok");
    expect(cleanDishName("")).toBe("Obrok");
  });

  it("test_truncates_an_overlong_name_with_a_single_ellipsis", () => {
    const long =
      "Punjena pileća prsa sa mocarelom, pršutom i sotiranim tikvicama u sosu";
    const out = cleanDishName(long);
    expect(out.length).toBeLessThanOrEqual(MAX_DISH_NAME);
    expect(out.endsWith("…")).toBe(true);
    // Only one ellipsis, and no dangling space before it.
    expect(out.match(/…/g)).toHaveLength(1);
    expect(out).not.toMatch(/ …$/);
  });

  it("test_keeps_a_name_that_is_exactly_at_the_limit_intact", () => {
    const exact = "a".repeat(MAX_DISH_NAME);
    expect(cleanDishName(exact)).toBe(exact);
  });
});

describe("cardFontText", () => {
  it("test_covers_serbian_letters_and_card_chrome_out_of_the_box", () => {
    // The reason the loader is text-driven: the subset must contain č/ć/š/ž/đ
    // if the dish name does, or the card renders tofu blocks for them. The
    // fixed chrome (wordmark, macro labels, tier badge) has to be in there too.
    const set = cardFontText("Ćevapčići, đuveč, šopska i ražnjići — žito");
    for (const ch of "Ććčšžđ— FitMesskcalPROTEINUGLJENIH.MASTgONYX0123456789") {
      expect(set).toContain(ch);
    }
  });

  it("test_an_ordinary_name_returns_the_base_set_unchanged", () => {
    // The cache-hit property: identical request text for every ordinary meal,
    // so `fonts.ts` fetches the subset once per server instance, not per card.
    expect(cardFontText("Ćevapčići sa lukom")).toBe(CARD_BASE_GLYPHS);
    expect(cardFontText("Obrok")).toBe(CARD_BASE_GLYPHS);
    expect(cardFontText("")).toBe(CARD_BASE_GLYPHS);
  });

  it("test_an_unusual_name_appends_only_its_missing_glyphs_sorted", () => {
    const set = cardFontText("Ручак 🍲");
    expect(set.startsWith(CARD_BASE_GLYPHS)).toBe(true);
    for (const ch of "Ручак🍲") expect(set).toContain(ch);
    // Order-independent, so two odd names differing only in order share one
    // cache entry -- and each missing glyph is asked for exactly once.
    expect(cardFontText("🍲 Ручак")).toBe(set);
    expect([...set].filter((c) => c === "🍲")).toHaveLength(1);
  });
});
