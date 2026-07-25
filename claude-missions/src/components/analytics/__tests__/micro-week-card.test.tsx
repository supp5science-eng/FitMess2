import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MicroWeekCard } from "@/components/analytics/micro-week-card";
import { microTargetsForKcal } from "@/lib/nutrition/micro";
import {
  computeMicroWeek,
  type MicroWeekLogInput,
} from "@/lib/nutrition/micro-week";

const NOW = new Date("2026-07-25T12:00:00Z");
const TARGETS = microTargetsForKcal(2000); // fiber 28 g, sugar 50 g, sodium 2300 mg

function renderCard(logs: MicroWeekLogInput[]) {
  render(<MicroWeekCard week={computeMicroWeek(logs, NOW, TARGETS)} />);
}

function log(
  day: string,
  kcal: number,
  micros: Partial<MicroWeekLogInput>
): MicroWeekLogInput {
  return { logged_at: `${day}T12:00:00Z`, kcal, grams: 100, ...micros };
}

describe("MicroWeekCard: the Analitika micronutrient card", () => {
  it("opens on fiber and shows the week's daily average against the goal", () => {
    renderCard([
      log("2026-07-24", 500, { fiber: 20 }),
      log("2026-07-25", 500, { fiber: 30 }),
    ]);

    expect(screen.getByTestId("micro-week-average")).toHaveTextContent("25 g");
    expect(screen.getByTestId("micro-week-card")).toHaveTextContent("cilj 28 g");
    expect(screen.getByTestId("micro-week-status")).toHaveTextContent(
      "fali 3 g"
    );
  });

  it("switches nutrients through the tabs", () => {
    renderCard([log("2026-07-25", 500, { fiber: 30, sodium: 3000 })]);

    fireEvent.click(screen.getByTestId("micro-week-tab-sodium"));

    expect(screen.getByTestId("micro-week-average")).toHaveTextContent(
      "3.000 mg"
    );
    // Past a ceiling: stated plainly, in the amber tone, never as a red alarm.
    expect(screen.getByTestId("micro-week-status")).toHaveTextContent(
      "700 mg dnevno preko granice"
    );
  });

  it("draws no bar for a day it cannot describe, and says how many", () => {
    renderCard([log("2026-07-25", 500, { fiber: 30 })]);

    expect(screen.getByTestId("micro-week-bar-2026-07-25")).toBeInTheDocument();
    expect(
      screen.queryByTestId("micro-week-bar-2026-07-24")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("micro-week-footer")).toHaveTextContent(
      "Za 6 dana nemamo dovoljno podataka"
    );
  });

  it("names a tapped day and shows its exact amount", () => {
    renderCard([
      log("2026-07-22", 500, { fiber: 12 }),
      log("2026-07-25", 500, { fiber: 30 }),
    ]);

    fireEvent.click(screen.getByTestId("micro-week-day-2026-07-22"));

    const readout = screen.getByTestId("micro-week-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("12 g");
    expect(readout).toHaveTextContent("Fali 16 g do cilja");
  });

  it("keeps the tapped day when the nutrient tab changes", () => {
    renderCard([log("2026-07-22", 500, { fiber: 12, sodium: 3000 })]);

    fireEvent.click(screen.getByTestId("micro-week-day-2026-07-22"));
    fireEvent.click(screen.getByTestId("micro-week-tab-sodium"));

    const readout = screen.getByTestId("micro-week-readout");
    expect(readout).toHaveTextContent("Sreda, 22. jul");
    expect(readout).toHaveTextContent("3.000 mg");
    expect(readout).toHaveTextContent("700 mg preko granice");
  });

  it("explains a day it could not measure instead of showing a number", () => {
    renderCard([log("2026-07-25", 500, { fiber: 30 })]);

    fireEvent.click(screen.getByTestId("micro-week-day-2026-07-22"));

    expect(screen.getByTestId("micro-week-readout")).toHaveTextContent(
      "Nema dovoljno podataka"
    );
  });

  it("shows one calm empty state when nothing was logged", () => {
    renderCard([]);

    expect(screen.getByTestId("micro-week-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("micro-week-average")).not.toBeInTheDocument();
  });

  it("degrades to a retry line when the read failed", () => {
    render(<MicroWeekCard week={null} />);

    expect(screen.getByText(/Nismo uspeli da učitamo/)).toBeInTheDocument();
  });
});
