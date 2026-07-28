import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StreakCard } from "@/components/streak/streak-card";
import { StreakSummaryCard } from "@/components/streak/streak-summary-card";
import { computeStreak, recentDayKeys } from "@/lib/streak/streak";

const TODAY = "2026-07-28";

/** A logged run of `n` days ending today (today included). */
function activeRun(n: number) {
  return computeStreak(recentDayKeys(TODAY, n), TODAY);
}

describe("StreakCard (home)", () => {
  it("shows the current count and the day noun for an active streak", () => {
    render(<StreakCard streak={activeRun(5)} />);
    expect(screen.getByTestId("streak-count")).toHaveTextContent("5");
    expect(screen.getByText("dana zaredom")).toBeInTheDocument();
  });

  it("uses the singular noun at a one-day streak", () => {
    render(<StreakCard streak={activeRun(1)} />);
    expect(screen.getByText("dan zaredom")).toBeInTheDocument();
  });

  it("invites a fresh start when there is no history", () => {
    render(<StreakCard streak={computeStreak([], TODAY)} />);
    expect(screen.getByTestId("streak-count")).toHaveTextContent(
      "Započni svoj niz"
    );
    expect(
      screen.getByText(/Uloguj obrok i započni niz/)
    ).toBeInTheDocument();
  });

  it("acknowledges a past record instead of shaming a broken streak", () => {
    // A 6-day record that ended a week ago; nothing logged since.
    const summary = computeStreak(
      ["2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15"],
      TODAY
    );
    expect(summary.current).toBe(0);
    expect(summary.best).toBe(6);

    render(<StreakCard streak={summary} />);
    expect(screen.getByTestId("streak-count")).toHaveTextContent(
      "Vrati svoj niz"
    );
    expect(screen.getByText(/Rekord ti je 6 dana/)).toBeInTheDocument();
  });

  it("celebrates the exact day a milestone is reached", () => {
    render(<StreakCard streak={activeRun(7)} />);
    expect(screen.getByText("Nedelju dana zaredom!")).toBeInTheDocument();
  });

  it("shows the climb toward the next milestone between milestones", () => {
    render(<StreakCard streak={activeRun(5)} />);
    expect(screen.getByText(/Još 2 dana do 7/)).toBeInTheDocument();
  });

  it("labels the dot row for assistive tech", () => {
    render(<StreakCard streak={activeRun(3)} />);
    // 3 of the last 7 days logged.
    expect(
      screen.getByLabelText("3 od poslednjih 7 dana sa unosom")
    ).toBeInTheDocument();
  });

  it("is a plain section (not a link) without an href", () => {
    render(<StreakCard streak={activeRun(3)} />);
    expect(screen.queryByTestId("streak-card-link")).not.toBeInTheDocument();
  });

  it("becomes a link to the given href when one is passed", () => {
    render(<StreakCard streak={activeRun(5)} href="/dostignuca" />);
    const link = screen.getByTestId("streak-card-link");
    expect(link).toHaveAttribute("href", "/dostignuca");
    expect(link).toHaveAccessibleName(/Otvori dostignuća/);
  });
});

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
