import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorkoutButton } from "@/components/home/workout-button";

// Trening (0026): the home screen's card. Three things matter here and all
// three are product decisions, not styling:
//   1. it opens the flow in one tap,
//   2. the number is framed as what a session COST -- never as calories that
//      may be eaten back (the plan already pays for training via the TDEE
//      activity multiplier, see `src/lib/workout/activities.ts`),
//   3. there is no goal and no ring -- a training quota is something you can
//      fail, and this feature records what you did rather than grading it.

const WEEK = [
  { label: "Ned", pct: 0, isToday: false },
  { label: "Pon", pct: 0.5, isToday: false },
  { label: "Uto", pct: 0, isToday: false },
  { label: "Sre", pct: 1, isToday: false },
  { label: "Čet", pct: 0, isToday: false },
  { label: "Pet", pct: 0.3, isToday: false },
  { label: "Sub", pct: 0.8, isToday: true },
];

describe("Trening card", () => {
  it("test_the_card_opens_the_workout_flow_in_one_tap", () => {
    render(<WorkoutButton />);

    expect(screen.getByTestId("workout-open-button")).toHaveAttribute(
      "href",
      "/dodaj/trening"
    );
  });

  it("test_an_empty_day_says_so_plainly_without_scolding", () => {
    render(<WorkoutButton kcal={0} minutes={0} />);

    expect(screen.getByTestId("workout-summary")).toHaveTextContent(
      "Danas ništa"
    );
    // Nothing to break down when nothing was logged.
    expect(screen.queryByTestId("workout-breakdown")).not.toBeInTheDocument();
  });

  it("test_a_logged_day_reports_what_it_cost_and_how_long_it_took", () => {
    render(<WorkoutButton kcal={371} minutes={60} />);

    expect(screen.getByTestId("workout-summary")).toHaveTextContent("371 kcal");
    expect(screen.getByTestId("workout-minutes")).toHaveTextContent("60 min");
  });

  it("test_the_breakdown_puts_the_session_next_to_resting_metabolism", () => {
    // The framing that keeps the number honest: resting is the far bigger
    // figure, and the session is shown as part of the day's total expenditure
    // rather than as an allowance that appeared.
    render(<WorkoutButton kcal={371} minutes={60} restingKcal={1877} />);

    const breakdown = screen.getByTestId("workout-breakdown").textContent ?? "";
    expect(breakdown).toContain("1877");
    expect(breakdown).toContain("371");
    expect(breakdown).toContain("2248");
    // Guards against the double-counting regression this feature exists to
    // avoid: nothing here may suggest the calories are available to eat.
    expect(breakdown).not.toMatch(/zaradio|dodatno|možeš da pojedeš/i);
  });

  it("test_a_profile_without_a_bmr_omits_the_total_instead_of_inventing_one", () => {
    render(<WorkoutButton kcal={371} minutes={60} restingKcal={null} />);

    expect(screen.queryByTestId("workout-breakdown")).not.toBeInTheDocument();
    expect(screen.getByTestId("workout-summary")).toHaveTextContent("371 kcal");
  });

  it("test_the_week_strip_compares_you_to_yourself_not_to_a_goal", () => {
    render(<WorkoutButton kcal={371} minutes={60} week={WEEK} />);

    const bars = screen
      .getByTestId("workout-week-bars")
      .querySelectorAll('[data-testid="mini-week-bar"]');
    expect(bars).toHaveLength(7);
    // No goal, so nothing on this card may announce one being met.
    expect(screen.queryByText(/cilj/i)).not.toBeInTheDocument();
  });
});
