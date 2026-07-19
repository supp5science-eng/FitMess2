import { describe, expect, it } from "vitest";

import { foldSerbian, foodEmoji } from "@/lib/food/emoji";

describe("foldSerbian", () => {
  it("folds Serbian-Latin diacritics to ASCII and lowercases", () => {
    expect(foldSerbian("Ćevapčići")).toBe("cevapcici");
    expect(foldSerbian("Šunka")).toBe("sunka");
    expect(foldSerbian("Đuveč")).toBe("djuvec");
    expect(foldSerbian("Žablji")).toBe("zablji");
  });
});

describe("foodEmoji", () => {
  it("maps common Serbian foods to a representative emoji", () => {
    expect(foodEmoji("Pečena piletina")).toBe("🍗");
    expect(foodEmoji("Ćevapi")).toBe("🥩");
    expect(foodEmoji("Losos na žaru")).toBe("🐟");
    expect(foodEmoji("Kajgana od 2 jaja")).toBe("🥚");
    expect(foodEmoji("Integralni hleb")).toBe("🍞");
    expect(foodEmoji("Pirinač")).toBe("🍚");
    expect(foodEmoji("Grčki jogurt")).toBe("🥛");
    expect(foodEmoji("Espreso")).toBe("☕");
    expect(foodEmoji("Banana")).toBe("🍌");
    expect(foodEmoji("Protein šejk")).toBe("🥤");
  });

  it("is accent- and case-insensitive", () => {
    expect(foodEmoji("CEVAPI")).toBe("🥩");
    expect(foodEmoji("čokoladica")).toBe("🍫");
  });

  it("falls back to a neutral plate for unknown foods", () => {
    expect(foodEmoji("Nešto nepoznato xyz")).toBe("🍽️");
    expect(foodEmoji("")).toBe("🍽️");
  });

  it("prefers a more specific rule over a generic one", () => {
    // "ćevap" (meso family) resolves before any bare fallback.
    expect(foodEmoji("Ćevapi sa lukom")).toBe("🥩");
    // pizza wins even though it could look like other baked goods.
    expect(foodEmoji("Pica Kapričoza")).toBe("🍕");
  });
});
