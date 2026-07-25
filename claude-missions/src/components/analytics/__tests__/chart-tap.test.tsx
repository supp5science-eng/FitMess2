import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { IntakeTrendCard } from "@/components/analytics/intake-trend-card";
import { MacroAverageCard } from "@/components/analytics/macro-average-card";
import { StepsCard } from "@/components/analytics/steps-card";
import { WaterCard } from "@/components/analytics/water-card";
import { computeStepsWeek } from "@/lib/steps/steps-week";
import { computeWaterWeek } from "@/lib/water/water-week";
import { computeMacroWeeks } from "@/lib/week/macro-weeks";
import { computeIntakeTrend } from "@/lib/weight/intake-trend";

// Every chart in Analitika answers a tap with that day's real numbers
// (2026-07-25). Before this the charts were mute: a tall bar stayed anonymous.
// These lock the shared behaviour -- name the day, print the figure, and let a
// second tap put it away.

const NOW = new Date("2026-07-25T12:00:00Z"); // Saturday
const WEDNESDAY = "2026-07-22";

describe("WaterCard: tapping a bar", () => {
  const week = computeWaterWeek(
    [{ day: WEDNESDAY, ml: 1500 }],
    NOW,
    2500
  );

  it("invites the tap before anything is picked", () => {
    render(<WaterCard week={week} />);

    expect(screen.getByTestId("water-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("water-readout")).not.toBeInTheDocument();
  });

  it("names the day and shows its litres vs the goal", () => {
    render(<WaterCard week={week} />);

    fireEvent.click(screen.getByTestId(`water-bar-${WEDNESDAY}`));

    const readout = screen.getByTestId("water-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("1,5 L");
    expect(readout).toHaveTextContent("60%");
  });

  it("puts the read-out away on a second tap of the same day", () => {
    render(<WaterCard week={week} />);

    fireEvent.click(screen.getByTestId(`water-bar-${WEDNESDAY}`));
    fireEvent.click(screen.getByTestId(`water-bar-${WEDNESDAY}`));

    expect(screen.queryByTestId("water-readout")).not.toBeInTheDocument();
    expect(screen.getByTestId("water-hint")).toBeInTheDocument();
  });

  it("says so plainly for a day with no water at all", () => {
    render(<WaterCard week={week} />);

    fireEvent.click(screen.getByTestId("water-bar-2026-07-21"));

    expect(screen.getByTestId("water-readout")).toHaveTextContent(
      "Tog dana nije uneta voda"
    );
  });
});

describe("StepsCard: tapping the line", () => {
  const week = computeStepsWeek([{ day: WEDNESDAY, steps: 8420 }], NOW);

  it("names the day and shows its steps and goal progress", () => {
    render(<StepsCard week={week} />);

    fireEvent.click(screen.getByTestId(`day-tap-${WEDNESDAY}`));

    const readout = screen.getByTestId("steps-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("8.420 koraka");
    expect(readout).toHaveTextContent("84%");
  });

  it("clears with the ✕ button", () => {
    render(<StepsCard week={week} />);

    fireEvent.click(screen.getByTestId(`day-tap-${WEDNESDAY}`));
    fireEvent.click(screen.getByTestId("steps-readout-clear"));

    expect(screen.queryByTestId("steps-readout")).not.toBeInTheDocument();
  });
});

describe("MacroAverageCard: tapping a bar", () => {
  const weeks = computeMacroWeeks(
    [
      {
        logged_at: `${WEDNESDAY}T12:00:00Z`,
        kcal: 2000,
        protein: 120,
        carbs: 200,
        fat: 70,
      },
    ],
    NOW,
    4
  );

  it("shows that day's kcal and macro grams", () => {
    render(<MacroAverageCard weeks={weeks} />);

    fireEvent.click(screen.getByTestId(`macro-bar-${WEDNESDAY}`));

    const readout = screen.getByTestId("macro-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("2.000 kcal");
    expect(readout).toHaveTextContent("P 120 g");
    expect(readout).toHaveTextContent("UH 200 g");
    expect(readout).toHaveTextContent("M 70 g");
  });

  it("drops the read-out when the week changes", () => {
    render(<MacroAverageCard weeks={weeks} />);

    fireEvent.click(screen.getByTestId(`macro-bar-${WEDNESDAY}`));
    fireEvent.click(screen.getByRole("tab", { name: "Prošla" }));

    expect(screen.queryByTestId("macro-readout")).not.toBeInTheDocument();
  });
});

describe("IntakeTrendCard: tapping the line", () => {
  const trend = computeIntakeTrend(
    [
      {
        logged_at: `${WEDNESDAY}T12:00:00Z`,
        kcal: 1500,
        protein: 100,
        carbs: 150,
        fat: 50,
      },
    ],
    NOW,
    {
      tdeeKcal: 2000,
      currentWeightKg: 80,
      targetFatG: 60,
      targetProteinG: 120,
    }
  );

  it("shows the estimate together with what was actually eaten", () => {
    render(<IntakeTrendCard trend={trend} />);

    fireEvent.click(screen.getByTestId(`day-tap-${WEDNESDAY}`));

    const readout = screen.getByTestId("intake-trend-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("Procena");
    expect(readout).toHaveTextContent("Uneto 1.500 kcal");
    expect(readout).toHaveTextContent("500 kcal manje od potrošnje");
  });

  it("admits an untracked day instead of implying zero intake", () => {
    render(<IntakeTrendCard trend={trend} />);

    fireEvent.click(screen.getByTestId("day-tap-2026-07-21"));

    expect(screen.getByTestId("intake-trend-readout")).toHaveTextContent(
      "nema unetih obroka"
    );
  });
});
