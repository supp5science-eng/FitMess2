import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HealthScoreCard } from "@/components/home/health-score-card";
import { MicroCards } from "@/components/home/micro-cards";
import { computeHealthScore } from "@/lib/nutrition/health-score";
import {
  computeMicroTotals,
  microTargetsForKcal,
  type MicroLogInput,
} from "@/lib/nutrition/micro";

const TARGETS = microTargetsForKcal(2000);

function renderCards(logs: MicroLogInput[]) {
  render(<MicroCards micros={computeMicroTotals(logs)} targets={TARGETS} />);
}

describe("MicroCards: the home tab's second page", () => {
  it("renders all four nutrients with Serbian labels", () => {
    renderCards([
      { kcal: 800, grams: 600, fiber: 10, sugar: 20, sodium: 900, sat_fat: 8 },
    ]);

    expect(screen.getByTestId("micro-card-fiber")).toHaveTextContent("Vlakna");
    expect(screen.getByTestId("micro-card-sugar")).toHaveTextContent("Šećer");
    expect(screen.getByTestId("micro-card-sodium")).toHaveTextContent("So");
    expect(screen.getByTestId("micro-card-satFat")).toHaveTextContent(
      "Zasićene masti"
    );
  });

  it("headlines what is LEFT of each goal/limit", () => {
    renderCards([
      { kcal: 800, grams: 600, fiber: 10, sugar: 20, sodium: 900, sat_fat: 8 },
    ]);

    // fiber goal 28 - 10 = 18 g left; sodium 2300 - 900 = 1.400 mg left
    expect(screen.getByTestId("micro-value-fiber")).toHaveTextContent("18 g");
    expect(screen.getByTestId("micro-value-sodium")).toHaveTextContent(
      "1.400 mg"
    );
  });

  it("shows how far PAST a limit the day is, and flags the card", () => {
    renderCards([
      { kcal: 1800, grams: 1200, fiber: 12, sugar: 40, sodium: 3100, sat_fat: 15 },
    ]);

    const sodium = screen.getByTestId("micro-card-sodium");
    expect(sodium).toHaveAttribute("data-over", "true");
    expect(screen.getByTestId("micro-value-sodium")).toHaveTextContent("800 mg");
    expect(sodium).toHaveTextContent("preko granice");
  });

  it("shows a dash -- never a confident 0 -- for a nutrient nothing described", () => {
    renderCards([{ kcal: 500, grams: 300 }]);

    expect(screen.getByTestId("micro-value-fiber")).toHaveTextContent("—");
    expect(screen.getByTestId("micro-card-fiber")).toHaveTextContent(
      "nema podataka"
    );
  });

  it("admits partial coverage when only some of the day is described", () => {
    renderCards([
      { kcal: 700, grams: 500, fiber: 8, sugar: 10, sodium: 600, sat_fat: 5 },
      { kcal: 300, grams: 200 },
    ]);

    expect(screen.getByTestId("micro-coverage-note")).toHaveTextContent("70%");
  });

  it("stays quiet about coverage on a fully-described day", () => {
    renderCards([
      { kcal: 700, grams: 500, fiber: 8, sugar: 10, sodium: 600, sat_fat: 5 },
    ]);

    expect(screen.queryByTestId("micro-coverage-note")).toBeNull();
  });

  it("stays quiet about coverage on an untouched day", () => {
    renderCards([]);
    expect(screen.queryByTestId("micro-coverage-note")).toBeNull();
  });
});

describe("HealthScoreCard", () => {
  function scoreFor(logs: MicroLogInput[], proteinG: number, kcal: number) {
    return computeHealthScore({
      consumedKcal: kcal,
      consumedProteinG: proteinG,
      micros: computeMicroTotals(logs),
      targetKcal: 2000,
      targetProteinG: 150,
      microTargets: TARGETS,
    });
  }

  it("shows the score with a Serbian decimal comma and its band label", () => {
    const score = scoreFor(
      [{ kcal: 1800, grams: 1500, fiber: 32, sugar: 18, sodium: 1100, sat_fat: 8 }],
      155,
      1800
    );
    render(<HealthScoreCard score={score} />);

    expect(screen.getByTestId("health-score-card")).toHaveTextContent(
      "Ocena zdravosti"
    );
    expect(screen.getByTestId("health-score-value")).not.toHaveTextContent(".");
    expect(screen.getByTestId("health-score-label")).toHaveTextContent(
      "Sve na broju"
    );
  });

  it("renders N/A with an explanation on an empty day", () => {
    render(<HealthScoreCard score={scoreFor([], 0, 0)} />);

    expect(screen.getByTestId("health-score-value")).toHaveTextContent("N/A");
    expect(screen.queryByTestId("health-score-label")).toBeNull();
    expect(screen.getByTestId("health-score-card")).toHaveTextContent("Unesi");
  });

  it("fills the bar in proportion to the score", () => {
    const score = scoreFor(
      [{ kcal: 2000, grams: 1600, fiber: 28, sugar: 50, sodium: 2300, sat_fat: 22 }],
      150,
      2000
    );
    render(<HealthScoreCard score={score} />);

    const bar = screen.getByTestId("health-score-bar");
    const width = Number.parseInt(bar.style.width, 10);
    expect(width).toBe(Math.round((score.score as number) * 10));
  });
});
