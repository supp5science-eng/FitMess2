import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StreakPill } from "@/components/streak/streak-pill";
import { computeStreak, recentDayKeys } from "@/lib/streak/streak";

const TODAY = "2026-07-28";

function activeRun(n: number) {
  return computeStreak(recentDayKeys(TODAY, n), TODAY);
}

describe("StreakPill (home entry)", () => {
  it("shows the current streak number", () => {
    render(<StreakPill streak={activeRun(5)} />);
    expect(screen.getByTestId("streak-pill-count")).toHaveTextContent("5");
  });

  it("is a plain span (not a link) without an href", () => {
    render(<StreakPill streak={activeRun(3)} />);
    expect(screen.getByTestId("streak-pill").tagName).toBe("SPAN");
  });

  it("becomes a link with an accessible name when given an href", () => {
    render(<StreakPill streak={activeRun(5)} href="/dostignuca" />);
    const link = screen.getByTestId("streak-pill");
    expect(link).toHaveAttribute("href", "/dostignuca");
    expect(link).toHaveAccessibleName(/Niz: 5 dana\. Otvori dostignuća\./);
  });

  it("stays calm (still renders 0) at a zero streak", () => {
    render(<StreakPill streak={computeStreak([], TODAY)} />);
    expect(screen.getByTestId("streak-pill-count")).toHaveTextContent("0");
  });
});
