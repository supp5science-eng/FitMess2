import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Ring } from "@/components/home/ring";

// Redesign 2026-07-20: the gauge always fills with consumption and is coloured
// by remaining budget (green >50% left, yellow 15-50%, red <15%/over). The
// toggle swaps only the CENTRE number (Preostalo vs Potrošeno); the three
// numbers are always distinct. Over the limit -> negative remaining + a second
// red lap.

describe("Ring: fixed, distinct numbers (Cilj / Potrošeno / Preostalo)", () => {
  it("test_remaining_view_puts_remaining_in_the_centre_with_cilj_and_potroseno_on_the_sides", () => {
    render(<Ring consumedKcal={1200} targetKcal={2000} />);

    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("800");
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent("Preostalo");
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
    expect(screen.getByTestId("home-ring")).toHaveAttribute(
      "aria-label",
      "Preostalo 800 kcal"
    );
  });

  it("test_no_consumption_yet_shows_the_full_target_as_remaining_and_an_empty_green_gauge", () => {
    render(<Ring consumedKcal={0} targetKcal={2000} />);
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("2000");
    const arc = screen.getByTestId("home-ring-arc");
    // Nothing eaten -> the fill lap is empty (offset = full 100).
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(100, 0);
    expect(arc).toHaveAttribute("data-level", "green");
  });

  it("test_the_three_numbers_are_never_the_same_value_in_either_view", () => {
    // consumed == remaining (half the target) used to read as the same number
    // on both sides -- now they sit in clearly different, labelled slots.
    render(<Ring consumedKcal={1000} targetKcal={2000} />);
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1000");
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
  });
});

describe("Ring: gauge always fills with consumption", () => {
  it("test_fill_reflects_consumed_over_target_in_the_default_view", () => {
    // 500 of 2000 consumed -> 25% filled -> offset 75.
    render(<Ring consumedKcal={500} targetKcal={2000} />);
    const offset = Number(
      screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset")
    );
    expect(offset).toBeCloseTo(75, 0);
  });

  it("test_consumed_view_swaps_the_centre_to_potroseno_but_keeps_the_same_fill", () => {
    render(<Ring consumedKcal={1500} targetKcal={2000} view="consumed" />);
    // Centre is now consumed; remaining moves to a side column.
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1500");
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("500");
    // Fill is consumed/target either way: 75% -> offset 25.
    const offset = Number(
      screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset")
    );
    expect(offset).toBeCloseTo(25, 0);
  });
});

describe("Ring: traffic-light colour by remaining budget", () => {
  it("test_more_than_half_left_is_green", () => {
    render(<Ring consumedKcal={500} targetKcal={2000} />); // 75% left
    expect(screen.getByTestId("home-ring-arc")).toHaveAttribute(
      "data-level",
      "green"
    );
  });

  it("test_between_15_and_50_percent_left_is_yellow", () => {
    render(<Ring consumedKcal={1600} targetKcal={2000} />); // 20% left
    expect(screen.getByTestId("home-ring-arc")).toHaveAttribute(
      "data-level",
      "yellow"
    );
  });

  it("test_under_15_percent_left_is_red", () => {
    render(<Ring consumedKcal={1800} targetKcal={2000} />); // 10% left
    expect(screen.getByTestId("home-ring-arc")).toHaveAttribute(
      "data-level",
      "red"
    );
  });
});

describe("Ring: over the limit -> negative remaining + second red lap", () => {
  it("test_over_limit_shows_the_remaining_number_as_negative", () => {
    render(<Ring consumedKcal={3500} targetKcal={3000} />);
    // 3000 - 3500 = -500 remaining, shown in the centre in the default view.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("-500");
    expect(screen.getByTestId("home-ring")).toHaveAttribute(
      "aria-label",
      "Prekoračeno 500 kcal"
    );
    expect(screen.getByTestId("home-ring-overshoot-note")).toHaveTextContent(
      "preko cilja"
    );
  });

  it("test_over_limit_turns_the_first_lap_full_red_and_draws_a_second_lap", () => {
    render(<Ring consumedKcal={3500} targetKcal={3000} />);
    const base = screen.getByTestId("home-ring-arc");
    expect(base).toHaveAttribute("data-level", "red");
    // First lap is full (offset 0).
    expect(Number(base.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 0);
    // Second lap shows the overshoot: 500/3000 ≈ 16.7% -> offset ≈ 83.3.
    const over = screen.getByTestId("home-ring-overshoot-arc");
    expect(Number(over.getAttribute("stroke-dashoffset"))).toBeCloseTo(83.3, 0);
  });

  it("test_under_budget_draws_no_second_lap", () => {
    render(<Ring consumedKcal={1000} targetKcal={2000} />);
    expect(
      screen.queryByTestId("home-ring-overshoot-arc")
    ).not.toBeInTheDocument();
  });

  it("test_over_limit_in_consumed_view_keeps_the_negative_remaining_on_the_side", () => {
    render(<Ring consumedKcal={3500} targetKcal={3000} view="consumed" />);
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("3500");
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("-500");
  });
});
