import { describe, expect, it } from "vitest";

import {
  FULL_EATEN_SHARE,
  MIN_EATEN_SHARE,
  applyEatenShare,
  clampEatenShare,
  eatenShareLabelKey,
  storedEatenShare,
} from "@/lib/log/eaten-share";

// "Nisam sve pojeo": rescaling a logged entry to the share of it that was
// actually eaten. The two ways this can silently corrupt a day are a share that
// shrinks a meal nobody asked to shrink, and a slider that can't be undone.

const meal = (over: Record<string, unknown> = {}) => ({
  name: "Ćevapi sa lepinjom",
  grams: 400,
  kcal: 980,
  protein: 44,
  carbs: 61,
  fat: 38,
  fiber: 4,
  sugar: null,
  sodium: 1200,
  sat_fat: null,
  components: [
    {
      naziv: "ćevapi",
      grami: 250,
      kcal: 680,
      protein_g: 38,
      uh_g: 2,
      mast_g: 30,
      kom_naziv: "ćevap",
      kom_grami: 25,
    },
    {
      naziv: "lepinja",
      grami: 150,
      kcal: 300,
      protein_g: 6,
      uh_g: 59,
      mast_g: 8,
      kom_naziv: "komad",
      kom_grami: 150,
    },
  ],
  ...over,
});

describe("clampEatenShare", () => {
  it("treats an unusable value as the whole plate, never as a smaller meal", () => {
    // The dangerous default: reading NaN as 0% would delete calories the user
    // actually ate, with nothing on screen to show it happened.
    expect(clampEatenShare(Number.NaN)).toBe(FULL_EATEN_SHARE);
    expect(clampEatenShare(Number.POSITIVE_INFINITY)).toBe(FULL_EATEN_SHARE);
  });

  it("holds the range", () => {
    expect(clampEatenShare(0)).toBe(MIN_EATEN_SHARE);
    expect(clampEatenShare(140)).toBe(FULL_EATEN_SHARE);
    expect(clampEatenShare(37.4)).toBe(37);
  });
});

describe("storedEatenShare", () => {
  it("reads every pre-0025 entry as 'ate all of it'", () => {
    expect(storedEatenShare({})).toBe(FULL_EATEN_SHARE);
    expect(storedEatenShare({ eaten_share: null })).toBe(FULL_EATEN_SHARE);
  });

  it("reads a numeric column that arrived as a string over PostgREST", () => {
    expect(storedEatenShare({ eaten_share: "60.00" as unknown as number })).toBe(
      60
    );
  });
});

describe("applyEatenShare", () => {
  it("scales every number on the row by one factor", () => {
    const result = applyEatenShare(meal(), 50);
    expect(result.grams).toBe(200);
    expect(result.kcal).toBe(490);
    expect(result.protein).toBe(22);
    expect(result.share).toBe(50);
  });

  it("scales the micronutrients too, and keeps unknown unknown", () => {
    const result = applyEatenShare(meal(), 50);
    expect(result.fiber).toBe(2);
    expect(result.sodium).toBe(600);
    // 0017: a meal whose sugar we never knew does not become 0 g of sugar
    // because it was half-eaten.
    expect(result.sugar).toBeNull();
    expect(result.satFat).toBeNull();
  });

  it("scales the breakdown but never the natural unit", () => {
    const result = applyEatenShare(meal(), 50);
    expect(result.components?.[0].grami).toBe(125);
    expect(result.components?.[0].kcal).toBe(340);
    // One ćevap weighs 25 g whether you ate the whole plate or half of it --
    // otherwise "Dodaj još → +1 ćevap" would add a different amount afterwards.
    expect(result.components?.[0].kom_grami).toBe(25);
    expect(result.components?.[0].kom_naziv).toBe("ćevap");
  });

  it("leaves an entry with no breakdown without one", () => {
    const result = applyEatenShare(meal({ components: null }), 40);
    expect(result.components).toBeNull();
  });

  it("scales from the entry's CURRENT share, so a second visit isn't compounded", () => {
    // The row already holds the eaten half; asking for 25% must land on a
    // quarter of the SERVED plate, not a quarter of what's left.
    const half = applyEatenShare(meal(), 50);
    const quarter = applyEatenShare(
      meal({ ...half, sat_fat: half.satFat, eaten_share: half.share }),
      25
    );
    expect(quarter.grams).toBe(100);
    expect(quarter.kcal).toBe(245);
  });

  it("is reversible — the whole point of storing the share", () => {
    // Set 30% by mistake, reopen, slide back to 100%: the entry must come back.
    // Without the stored ratio the only way back would be to ask for 333%.
    const cut = applyEatenShare(meal(), 30);
    const back = applyEatenShare(
      { ...meal(), ...cut, sat_fat: cut.satFat, eaten_share: cut.share },
      FULL_EATEN_SHARE
    );
    expect(back.grams).toBeCloseTo(400, 0);
    expect(back.kcal).toBe(980);
    expect(back.share).toBe(FULL_EATEN_SHARE);
  });

  it("reports 'nothing to do' when the share is already the stored one", () => {
    expect(applyEatenShare(meal(), FULL_EATEN_SHARE).isNoop).toBe(true);
    expect(applyEatenShare(meal({ eaten_share: 60 }), 60).isNoop).toBe(true);
    expect(applyEatenShare(meal(), 60).isNoop).toBe(false);
  });

  it("never scales an entry down to nothing", () => {
    // `logs.grams` carries a `> 0` check — a meal nobody touched is a delete,
    // not a share.
    const result = applyEatenShare(meal({ grams: 1 }), MIN_EATEN_SHARE);
    expect(result.grams).toBeGreaterThan(0);
  });
});

describe("eatenShareLabelKey", () => {
  it("says 'all of it' only for an actually empty plate", () => {
    expect(eatenShareLabelKey(100)).toBe("dodaj.eaten.all");
    expect(eatenShareLabelKey(95)).toBe("dodaj.eaten.almostAll");
  });

  it("gives every step words a person would use", () => {
    expect(eatenShareLabelKey(75)).toBe("dodaj.eaten.mostOfIt");
    expect(eatenShareLabelKey(50)).toBe("dodaj.eaten.half");
    expect(eatenShareLabelKey(30)).toBe("dodaj.eaten.aThird");
    expect(eatenShareLabelKey(10)).toBe("dodaj.eaten.aBit");
  });
});
