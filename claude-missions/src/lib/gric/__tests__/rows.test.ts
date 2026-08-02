import { describe, expect, it } from "vitest";

import {
  buildGricRows,
  groupByOccasion,
  naturalUnit,
  occasionName,
  type GricRowItem,
} from "@/lib/gric/rows";

const item = (
  name: string,
  overrides: Partial<GricRowItem> = {}
): GricRowItem => ({
  name,
  amount: "1 komad",
  grams: 100,
  kcal: 150,
  protein: 5,
  carbs: 10,
  fat: 8,
  ...overrides,
});

describe("groupByOccasion", () => {
  it("collects items sharing an occasion, in the order they were spoken", () => {
    const groups = groupByOccasion([
      item("Jaja", { group: 0 }),
      item("Sladoled", { group: 1 }),
      item("Slanina", { group: 0 }),
    ]);

    expect(groups.map((group) => group.map((i) => i.name))).toEqual([
      ["Jaja", "Slanina"],
      ["Sladoled"],
    ]);
  });

  it("gives every untagged item its own occasion", () => {
    const groups = groupByOccasion([item("Jabuka"), item("Kafa")]);
    expect(groups).toHaveLength(2);
  });

  it("never lets an untagged item join a real occasion", () => {
    // The synthetic id for an untagged item must not collide with group 0 --
    // "Opet isto" sends untagged items and they must stay separate entries.
    const groups = groupByOccasion([
      item("Jaja", { group: 0 }),
      item("Jabuka"),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("occasionName", () => {
  it("leaves a single item alone", () => {
    expect(occasionName(["Krastavac"])).toBe("Krastavac");
  });

  it("joins a plate the way it is said out loud", () => {
    expect(occasionName(["Jaja", "Slanina", "Hleb"])).toBe(
      "Jaja, slanina i hleb"
    );
    expect(occasionName(["Kafa", "Keks"])).toBe("Kafa i keks");
  });

  it("counts the rest once the name would stop fitting on a card", () => {
    expect(
      occasionName(["Jaja", "Slanina", "Hleb", "Sir", "Kajmak"])
    ).toBe("Jaja, slanina i još 3");
  });

  it("falls back to a name rather than an empty entry", () => {
    expect(occasionName([])).toBe("Obrok");
    expect(occasionName(["  "])).toBe("Obrok");
  });
});

describe("naturalUnit", () => {
  it("derives one piece from a spoken count", () => {
    expect(naturalUnit("2 komada", 100)).toEqual({
      kom_naziv: "komad",
      kom_grami: 50,
    });
  });

  it("understands a measure with no digits", () => {
    expect(naturalUnit("šaka", 25)).toEqual({
      kom_naziv: "šaka",
      kom_grami: 25,
    });
  });

  it("reads spelled-out counts", () => {
    expect(naturalUnit("par kašika", 30)).toEqual({
      kom_naziv: "kašika",
      kom_grami: 15,
    });
    expect(naturalUnit("tri kriške", 105)).toEqual({
      kom_naziv: "kriška",
      kom_grami: 35,
    });
  });

  it("still counts pieces when the food is its own unit", () => {
    // "2 kajsije" has no measure word, but it is plainly two of something.
    expect(naturalUnit("2 kajsije", 80)).toEqual({
      kom_naziv: "komad",
      kom_grami: 40,
    });
  });

  it("gives up rather than invent a unit", () => {
    expect(naturalUnit("malo", 40)).toEqual({ kom_naziv: "", kom_grami: 0 });
    expect(naturalUnit("", 40)).toEqual({ kom_naziv: "", kom_grami: 0 });
    expect(naturalUnit(undefined, 40)).toEqual({ kom_naziv: "", kom_grami: 0 });
    // Nothing to divide: a unit mass would be meaningless.
    expect(naturalUnit("2 komada", 0)).toEqual({ kom_naziv: "", kom_grami: 0 });
  });
});

describe("buildGricRows", () => {
  it("writes one entry for one plate, with its parts kept", () => {
    const rows = buildGricRows([
      item("Jaja", { group: 0, amount: "2 komada", grams: 100, kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.9 }),
      item("Slanina", { group: 0, amount: "2 kriške", grams: 30, kcal: 162, protein: 11, carbs: 0.4, fat: 12.6 }),
      item("Hleb", { group: 0, amount: "1 kriška", grams: 35, kcal: 92, protein: 3, carbs: 17, fat: 1 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Jaja, slanina i hleb");
    expect(rows[0].kcal).toBe(397);
    expect(rows[0].grams).toBe(165);
    expect(rows[0].components).toHaveLength(3);
    // The breakdown is what makes "+1 jaje" possible on this entry.
    expect(rows[0].components?.[0]).toMatchObject({
      naziv: "Jaja",
      kom_naziv: "komad",
      kom_grami: 50,
    });
  });

  it("keeps separate sittings as separate entries", () => {
    const rows = buildGricRows([
      item("Čokolada", { group: 0, kcal: 260 }),
      item("Sladoled", { group: 1, kcal: 210 }),
    ]);

    expect(rows.map((row) => row.name)).toEqual(["Čokolada", "Sladoled"]);
    expect(rows.map((row) => row.kcal)).toEqual([260, 210]);
  });

  it("adds no breakdown to a single-item entry", () => {
    const rows = buildGricRows([item("Krastavac", { group: 0 })]);
    expect(rows[0].components).toBeNull();
    expect(rows[0].name).toBe("Krastavac");
  });

  it("makes the entry exactly the sum of its parts", () => {
    const rows = buildGricRows([
      item("A", { group: 0, grams: 33.33, kcal: 100.4, protein: 1.11, carbs: 2.22, fat: 3.33 }),
      item("B", { group: 0, grams: 66.66, kcal: 99.6, protein: 2.22, carbs: 3.33, fat: 4.44 }),
    ]);

    const parts = rows[0].components!;
    const sum = (pick: (p: (typeof parts)[number]) => number) =>
      parts.reduce((total, part) => total + pick(part), 0);

    // The card, "Dodaj još" and "Nisam sve pojeo" all rescale against this
    // equality -- a row that disagrees with its own parts drifts on every edit.
    expect(rows[0].kcal).toBe(Math.round(sum((p) => p.kcal)));
    expect(rows[0].grams).toBeCloseTo(sum((p) => p.grami), 5);
    expect(rows[0].protein).toBeCloseTo(sum((p) => p.protein_g), 5);
  });

  it("treats untagged items as their own entries", () => {
    // What the one-tap "Opet isto" chip sends.
    const rows = buildGricRows([item("Jabuka")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].components).toBeNull();
  });
});
