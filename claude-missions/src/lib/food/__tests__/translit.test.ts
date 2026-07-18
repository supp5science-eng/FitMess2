import { describe, expect, it } from "vitest";

import { cyrillicToLatin, hasCyrillic } from "@/lib/food/translit";

// F023 / AS-037 (searching with Cyrillic input returns foods stored with
// Latin names): unit coverage for the pure transliteration step that makes
// this possible. `src/app/api/foods/search/__tests__/route.integration.test.ts`
// proves the end-to-end behaviour against the live `foods` catalog; this
// file proves the character-mapping logic itself, including full digraph
// coverage (lj/nj/dž) per the F023 clarified scope.

describe("F023: cyrillicToLatin (Serbian Cyrillic -> Latin transliteration)", () => {
  it("test_AS_037_transliterates_every_plain_lowercase_cyrillic_letter", () => {
    expect(cyrillicToLatin("абвгдежзијклмнопрстћуфхцчш")).toBe(
      "abvgdežzijklmnoprstćufhcčš"
    );
  });

  it("test_AS_037_transliterates_every_plain_uppercase_cyrillic_letter", () => {
    expect(cyrillicToLatin("АБВГДЕЖЗИЈКЛМНОПРСТЋУФХЦЧШ")).toBe(
      "ABVGDEŽZIJKLMNOPRSTĆUFHCČŠ"
    );
  });

  it("test_AS_037_transliterates_the_lj_digraph_letter_lowercase_and_uppercase", () => {
    expect(cyrillicToLatin("љубав")).toBe("ljubav");
    expect(cyrillicToLatin("Љубав")).toBe("Ljubav");
  });

  it("test_AS_037_transliterates_the_nj_digraph_letter_lowercase_and_uppercase", () => {
    expect(cyrillicToLatin("њега")).toBe("njega");
    expect(cyrillicToLatin("Његов")).toBe("Njegov");
  });

  it("test_AS_037_transliterates_the_dz_digraph_letter_lowercase_and_uppercase", () => {
    expect(cyrillicToLatin("џем")).toBe("džem");
    expect(cyrillicToLatin("Џем")).toBe("Džem");
  });

  it("test_AS_037_transliterates_dj_c_c_s_z_lowercase_and_uppercase", () => {
    expect(cyrillicToLatin("ђ ћ ч ш ж")).toBe("đ ć č š ž");
    expect(cyrillicToLatin("Ђ Ћ Ч Ш Ж")).toBe("Đ Ć Č Š Ž");
  });

  it("test_AS_037_translates_a_real_food_name_плазма_to_plazma", () => {
    expect(cyrillicToLatin("Плазма")).toBe("Plazma");
  });

  it("test_AS_037_translates_a_real_food_name_сарма_to_sarma", () => {
    expect(cyrillicToLatin("сарма")).toBe("sarma");
  });

  it("test_AS_037_translates_a_food_name_containing_a_digraph_ђевђелијски_ajvar", () => {
    // "đevđelijski" would be typed in Cyrillic as "ђевђелијски" -- both ђ
    // occurrences must become đ, not the lj/nj/dž digraph letters.
    expect(cyrillicToLatin("ђевђелијски")).toBe("đevđelijski");
  });

  it("test_AS_036_latin_script_input_passes_through_unchanged_no_op_for_already_latin_queries", () => {
    expect(cyrillicToLatin("Plazma")).toBe("Plazma");
    expect(cyrillicToLatin("sarma")).toBe("sarma");
    expect(cyrillicToLatin("čokolada")).toBe("čokolada");
  });

  it("test_AS_037_digits_punctuation_and_whitespace_pass_through_unchanged", () => {
    expect(cyrillicToLatin("сарма 100г, домаћа!")).toBe("sarma 100g, domaća!");
  });

  it("test_AS_037_mixed_cyrillic_and_latin_input_transliterates_only_the_cyrillic_part", () => {
    expect(cyrillicToLatin("Кока Cola")).toBe("Koka Cola");
  });
});

describe("F023: hasCyrillic", () => {
  it("test_hasCyrillic_true_for_cyrillic_input", () => {
    expect(hasCyrillic("сарма")).toBe(true);
    expect(hasCyrillic("Плазма")).toBe(true);
  });

  it("test_hasCyrillic_false_for_pure_latin_input", () => {
    expect(hasCyrillic("sarma")).toBe(false);
    expect(hasCyrillic("Plazma")).toBe(false);
    expect(hasCyrillic("čokolada 100g!")).toBe(false);
  });

  it("test_hasCyrillic_true_for_mixed_input", () => {
    expect(hasCyrillic("Кока Cola")).toBe(true);
  });
});
