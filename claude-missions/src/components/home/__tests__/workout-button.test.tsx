import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkoutButton } from "@/components/home/workout-button";

// Trening (0026): the home screen's compact entry point. Two things matter
// here and both are product decisions, not styling: the button opens the flow
// in one tap, and the number it shows is framed as what a session COST -- never
// as calories that may be eaten back. The plan already pays for training via
// the TDEE activity multiplier (`src/lib/workout/activities.ts`), so a wording
// change that turned this into "you earned 320 kcal" would be a real bug.

describe("Trening card", () => {
  it("test_the_card_opens_the_workout_flow_in_one_tap", () => {
    render(<WorkoutButton />);

    expect(screen.getByTestId("workout-open-button")).toHaveAttribute(
      "href",
      "/dodaj/trening"
    );
  });

  it("test_an_empty_day_invites_an_entry_instead_of_showing_a_zero", () => {
    render(<WorkoutButton kcal={0} minutes={0} />);

    // "0 min · 0 kcal" would read as a verdict on the user's day; the empty
    // state asks a question instead.
    expect(screen.getByTestId("workout-summary")).toHaveTextContent(
      "Upiši šta si radio danas"
    );
  });

  it("test_a_logged_day_reports_minutes_and_what_they_cost", () => {
    render(<WorkoutButton kcal={357} minutes={60} />);

    const summary = screen.getByTestId("workout-summary");
    expect(summary).toHaveTextContent("60 min");
    expect(summary).toHaveTextContent("357 kcal");
  });

  it("test_the_wording_frames_the_burn_as_spent_not_as_earned", () => {
    render(<WorkoutButton kcal={357} minutes={60} />);

    const summary = screen.getByTestId("workout-summary").textContent ?? "";
    expect(summary).toContain("potrošeno");
    // Guards against the double-counting regression this feature exists to
    // avoid: nothing here may suggest the calories are available to eat.
    expect(summary).not.toMatch(/zaradio|dodatno|možeš da pojedeš/i);
  });
});
