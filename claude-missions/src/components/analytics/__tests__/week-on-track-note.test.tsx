import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WeekOnTrackNote } from "@/components/analytics/week-on-track-note";

// "Nedelja ti je u planu", moved here from the home screen's plan card
// (2026-08-01). It was the wrong place twice: that card answers "what do I do
// TODAY", and it sat inside the swipe pager -- where every page shares the
// tallest page's height, so saying "you're fine" cost the other two pages real
// dead space. Here it is a disclaimer over the analytics it describes.

describe("Nedelja ti je u planu — the week's standing above Analitika", () => {
  it("says the week is on plan, rather than only implying it", () => {
    render(<WeekOnTrackNote roomKcal={1200} daysLeft={3} />);
    expect(screen.getByTestId("analytics-on-track")).toHaveTextContent(
      "Nedelja ti je u planu"
    );
  });

  it("states the actual cushion, not just a compliment", () => {
    render(<WeekOnTrackNote roomKcal={1200} daysLeft={3} />);
    expect(screen.getByTestId("analytics-on-track")).toHaveTextContent(
      "1.200 kcal"
    );
  });

  it("carries the days left, which the card's week line used to supply", () => {
    render(<WeekOnTrackNote roomKcal={2050} daysLeft={2} />);
    expect(screen.getByTestId("analytics-on-track")).toHaveTextContent(
      "Još 2 dana"
    );
  });

  it("says 'dan', not 'dana', on the last day of the week", () => {
    render(<WeekOnTrackNote roomKcal={400} daysLeft={1} />);
    const note = screen.getByTestId("analytics-on-track");
    expect(note).toHaveTextContent("Još 1 dan ");
    expect(note).not.toHaveTextContent("Još 1 dana");
  });

  it("groups thousands the Serbian way, like every other figure in the app", () => {
    render(<WeekOnTrackNote roomKcal={12500} daysLeft={4} />);
    expect(screen.getByTestId("analytics-on-track")).toHaveTextContent(
      "12.500 kcal"
    );
  });
});
