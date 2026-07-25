import { describe, expect, it } from "vitest";

import { microTargetsForKcal } from "@/lib/nutrition/micro";
import {
  computeMicroWeek,
  type MicroWeekLogInput,
} from "@/lib/nutrition/micro-week";

// Belgrade is UTC+2 in July, so midday-UTC timestamps land unambiguously on
// their intended calendar day.
const NOW = new Date("2026-07-25T12:00:00Z"); // Saturday
const TARGETS = microTargetsForKcal(2000); // fiber 28 g, sugar 50 g, sodium 2300 mg, satFat 22 g

function log(
  day: string,
  kcal: number,
  micros: Partial<
    Pick<MicroWeekLogInput, "fiber" | "sugar" | "sodium" | "sat_fat" | "food">
  > = {}
): MicroWeekLogInput {
  return {
    logged_at: `${day}T12:00:00Z`,
    kcal,
    grams: 100,
    ...micros,
  };
}

function nutrient(week: ReturnType<typeof computeMicroWeek>, key: string) {
  return week.nutrients.find((n) => n.key === key)!;
}

describe("computeMicroWeek", () => {
  it("covers the trailing 7 calendar days, oldest first, ending today", () => {
    const week = computeMicroWeek([], NOW, TARGETS);
    const days = nutrient(week, "fiber").days;

    expect(days).toHaveLength(7);
    expect(days[0]!.dayKey).toBe("2026-07-19");
    expect(days[6]!.dayKey).toBe("2026-07-25");
    expect(days[6]!.isToday).toBe(true);
    expect(days.map((d) => d.label)).toEqual([
      "Ned",
      "Pon",
      "Uto",
      "Sre",
      "Čet",
      "Pet",
      "Sub",
    ]);
  });

  it("sums a day's entries and averages only over measured days", () => {
    const week = computeMicroWeek(
      [
        log("2026-07-24", 500, { fiber: 10 }),
        log("2026-07-24", 500, { fiber: 8 }),
        log("2026-07-25", 400, { fiber: 30 }),
      ],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.days[5]!.value).toBe(18); // Friday
    expect(fiber.days[6]!.value).toBe(30); // today
    expect(fiber.daysWithData).toBe(2);
    // (18 + 30) / 2 -- the five untracked days never drag the average down
    expect(fiber.average).toBe(24);
    expect(week.loggedDaysCount).toBe(2);
  });

  it("leaves an untracked day unknown, never a confident zero", () => {
    const week = computeMicroWeek(
      [log("2026-07-25", 400, { fiber: 30 })],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.days[0]!.value).toBeNull();
    expect(fiber.days[0]!.inTarget).toBe(false);
    expect(fiber.daysWithoutData).toBe(6);
  });

  it("drops a day whose nutrient covers too little of its calories", () => {
    // 200 of 1000 kcal describe fiber -> 20% coverage, below the 50% floor.
    const week = computeMicroWeek(
      [
        log("2026-07-25", 200, { fiber: 4 }),
        log("2026-07-25", 800, {}),
      ],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.days[6]!.value).toBeNull();
    expect(fiber.days[6]!.coverage).toBeCloseTo(0.2, 5);
    expect(fiber.average).toBeNull();
    expect(fiber.status).toBe("no-data");
  });

  it("keeps a day whose nutrient covers most of its calories", () => {
    const week = computeMicroWeek(
      [
        log("2026-07-25", 800, { fiber: 20 }),
        log("2026-07-25", 200, {}),
      ],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.days[6]!.value).toBe(20);
    expect(fiber.days[6]!.coverage).toBeCloseTo(0.8, 5);
  });

  it("falls back to the catalog food's per-100g values when the log has none", () => {
    const week = computeMicroWeek(
      [
        {
          logged_at: "2026-07-25T12:00:00Z",
          kcal: 300,
          grams: 200,
          food: { fiber_100g: 5, sugar_100g: 10 },
        },
      ],
      NOW,
      TARGETS
    );

    expect(nutrient(week, "fiber").days[6]!.value).toBe(10); // 5 g/100 g x 200 g
    expect(nutrient(week, "sugar").days[6]!.value).toBe(20);
    // Nothing described sodium, so it stays unknown rather than becoming 0.
    expect(nutrient(week, "sodium").days[6]!.value).toBeNull();
  });

  it("scores fiber as a goal to reach and the other three as ceilings", () => {
    const week = computeMicroWeek(
      [log("2026-07-25", 500, { fiber: 30, sugar: 70, sodium: 1000, sat_fat: 5 })],
      NOW,
      TARGETS
    );

    expect(nutrient(week, "fiber").days[6]!.inTarget).toBe(true); // 30 >= 28
    expect(nutrient(week, "fiber").status).toBe("ok");
    expect(nutrient(week, "sugar").days[6]!.inTarget).toBe(false); // 70 > 50
    expect(nutrient(week, "sugar").status).toBe("over");
    expect(nutrient(week, "sodium").days[6]!.inTarget).toBe(true); // 1000 <= 2300
    expect(nutrient(week, "satFat").status).toBe("ok");
  });

  it("reports a fiber average short of the goal as 'under'", () => {
    const week = computeMicroWeek(
      [log("2026-07-25", 500, { fiber: 12 })],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.status).toBe("under");
    expect(fiber.daysInTarget).toBe(0);
  });

  it("scales the chart above both the target line and the tallest day", () => {
    const week = computeMicroWeek(
      [log("2026-07-25", 500, { fiber: 60 })],
      NOW,
      TARGETS
    );
    const fiber = nutrient(week, "fiber");

    expect(fiber.chartMax).toBeGreaterThan(60);
    // An empty nutrient still leaves room for its target line.
    expect(nutrient(week, "sodium").chartMax).toBeGreaterThanOrEqual(2300);
  });

  it("ignores logs outside the 7-day window", () => {
    const week = computeMicroWeek(
      [
        log("2026-07-18", 500, { fiber: 40 }),
        log("2026-07-26", 500, { fiber: 40 }),
      ],
      NOW,
      TARGETS
    );

    expect(nutrient(week, "fiber").daysWithData).toBe(0);
    expect(week.loggedDaysCount).toBe(0);
    expect(week.isEmpty).toBe(true);
  });

  it("is empty (but never throws) with no logs at all", () => {
    const week = computeMicroWeek([], NOW, TARGETS);

    expect(week.isEmpty).toBe(true);
    expect(week.nutrients).toHaveLength(4);
    expect(nutrient(week, "sugar").average).toBeNull();
    expect(nutrient(week, "sugar").daysWithoutData).toBe(7);
  });
});
