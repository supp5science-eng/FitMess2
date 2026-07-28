import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StreakSummaryCard } from "@/components/streak/streak-summary-card";
import { computeStreak, recentDayKeys } from "@/lib/streak/streak";

const TODAY = "2026-07-28";

/** A logged run of `n` days ending today (today included). */
function activeRun(n: number) {
  return computeStreak(recentDayKeys(TODAY, n), TODAY);
}

describe("StreakSummaryCard (analitika)", () => {
  it("shows the current count and the personal record", () => {
    const summary = computeStreak(
      [
        // old 8-day record
        ...recentDayKeys("2026-06-10", 8),
        // current 3-day run
        ...recentDayKeys(TODAY, 3),
      ],
      TODAY
    );
    render(<StreakSummaryCard streak={summary} />);
    expect(screen.getByTestId("streak-summary-count")).toHaveTextContent("3");
    expect(screen.getByText(/Najduži niz: 8 dana/)).toBeInTheDocument();
  });

  it("renders the labeled weekday dot row", () => {
    render(<StreakSummaryCard streak={activeRun(2)} />);
    // 28 Jul 2026 is a Tuesday -> "uto" is today's label.
    expect(screen.getByText("uto")).toBeInTheDocument();
  });

  it("confirms today's entry when logged", () => {
    render(<StreakSummaryCard streak={activeRun(4)} />);
    expect(screen.getByText(/Danas je ubeleženo/)).toBeInTheDocument();
  });
});
