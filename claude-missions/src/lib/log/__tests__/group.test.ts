import { describe, expect, it } from "vitest";

import {
  belgradeDayLabel,
  groupLogsByDay,
  type MealLogItem,
} from "@/lib/log/group";

const NOW = new Date("2026-07-15T10:00:00.000Z"); // Wed 2026-07-15, 12:00 Belgrade

function meal(
  id: string,
  logged_at: string,
  kcal: number,
  name = "Obrok"
): MealLogItem {
  return { id, name, grams: 100, kcal, protein: 10, carbs: 20, fat: 5, logged_at };
}

describe("belgradeDayLabel", () => {
  it("labels today and yesterday specially", () => {
    expect(belgradeDayLabel("2026-07-15", "2026-07-15", "2026-07-14")).toBe(
      "Danas"
    );
    expect(belgradeDayLabel("2026-07-14", "2026-07-15", "2026-07-14")).toBe(
      "Juče"
    );
  });
  it("labels other days as weekday + day + month (sr)", () => {
    // 2026-07-10 is a Friday.
    expect(belgradeDayLabel("2026-07-10", "2026-07-15", "2026-07-14")).toBe(
      "petak, 10. jul"
    );
    // 2026-07-13 is a Monday.
    expect(belgradeDayLabel("2026-07-13", "2026-07-15", "2026-07-14")).toBe(
      "ponedeljak, 13. jul"
    );
  });
});

describe("groupLogsByDay", () => {
  it("groups by Belgrade day, newest day first, newest meal first, with day totals", () => {
    const groups = groupLogsByDay(
      [
        meal("a", "2026-07-15T07:00:00.000Z", 500),
        meal("b", "2026-07-15T10:00:00.000Z", 300),
        meal("c", "2026-07-14T08:00:00.000Z", 700),
        meal("d", "2026-07-10T08:00:00.000Z", 400),
      ],
      NOW
    );

    expect(groups.map((g) => g.dayKey)).toEqual([
      "2026-07-15",
      "2026-07-14",
      "2026-07-10",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Danas",
      "Juče",
      "petak, 10. jul",
    ]);
    // today: newest meal (10:00Z) before earlier (07:00Z)
    expect(groups[0]!.logs.map((l) => l.id)).toEqual(["b", "a"]);
    expect(groups[0]!.totalKcal).toBe(800);
    expect(groups[1]!.totalKcal).toBe(700);
  });

  it("assigns a late-evening UTC log to the correct next Belgrade day", () => {
    // 2026-07-14T22:30Z = 2026-07-15 00:30 local -> Danas, not Juče.
    const groups = groupLogsByDay(
      [meal("late", "2026-07-14T22:30:00.000Z", 200)],
      NOW
    );
    expect(groups[0]!.dayKey).toBe("2026-07-15");
    expect(groups[0]!.label).toBe("Danas");
  });

  it("returns an empty array for no logs", () => {
    expect(groupLogsByDay([], NOW)).toEqual([]);
  });
});
