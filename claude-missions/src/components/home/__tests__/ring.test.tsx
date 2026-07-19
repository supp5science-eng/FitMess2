import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Ring } from "@/components/home/ring";

describe("AS-047: Ring reports today's remaining calories", () => {
  it("test_AS_047_shows_preostalo_label_and_the_correctly_computed_remaining_kcal_value", () => {
    render(<Ring consumedKcal={1200} targetKcal={2000} />);

    expect(screen.getByTestId("home-ring-label")).toHaveTextContent(
      "Preostalo"
    );
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("800");
    expect(screen.getByTestId("home-ring")).toHaveAttribute(
      "aria-label",
      "Preostalo 800 kcal"
    );
  });

  it("test_AS_047_no_consumption_yet_shows_the_full_target_as_remaining", () => {
    render(<Ring consumedKcal={0} targetKcal={2000} />);
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("2000");
  });

  it("test_AS_047_the_gauge_fill_reflects_the_remaining_over_target_fraction_by_default", () => {
    // 500 of 2000 consumed -> 1500 (75%) remaining -> the fill (drawn from the
    // start, the rest dashed out on a pathLength=100 arc) leaves offset 25.
    render(<Ring consumedKcal={500} targetKcal={2000} />);
    const offset = Number(
      screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset")
    );
    expect(offset).toBeCloseTo(25, 0);
  });

  it("test_ring_columns_show_preostalo_left_cilj_center_potroseno_right", () => {
    const { container } = render(
      <Ring consumedKcal={800} targetKcal={2000} />
    );
    // Left = Preostalo 1200, centre = Cilj 2000, right = Potrošeno 800.
    expect(container).toHaveTextContent("Preostalo");
    expect(container).toHaveTextContent("Cilj");
    expect(container).toHaveTextContent("Potrošeno");
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1200");
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("800");
  });
});

describe("Ring view toggle: 'Potrošeno' (consumed) mode fills the gauge up", () => {
  it("test_ring_consumed_view_fills_the_gauge_by_consumed_over_target", () => {
    // 1500 of 2000 consumed -> 75% -> offset 25.
    render(<Ring consumedKcal={1500} targetKcal={2000} view="consumed" />);
    const offset = Number(
      screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset")
    );
    expect(offset).toBeCloseTo(25, 0);
  });

  it("test_ring_consumed_view_keeps_the_three_labelled_columns_unchanged", () => {
    render(<Ring consumedKcal={1500} targetKcal={2000} view="consumed" />);
    // The toggle only changes the gauge fill; the numbers stay put.
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent(
      "Preostalo"
    );
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("500");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1500");
  });
});

describe("AS-050: overshoot state is calm, neutral, and the gauge stays functional", () => {
  it("test_AS_050_consumed_exceeding_target_switches_the_copy_to_prekoraceno_with_the_overshoot_amount", () => {
    render(<Ring consumedKcal={2300} targetKcal={2000} />);

    expect(screen.getByTestId("home-ring-label")).toHaveTextContent(
      "Prekoračeno"
    );
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("300");
    expect(screen.getByTestId("home-ring")).toHaveAttribute(
      "aria-label",
      "Prekoračeno 300 kcal"
    );
  });

  it("test_AS_050_shows_a_reassuring_neutral_serbian_note_rather_than_an_alarming_message", () => {
    render(<Ring consumedKcal={2300} targetKcal={2000} />);
    const note = screen.getByTestId("home-ring-overshoot-note");

    expect(note).toHaveTextContent(
      "Jedan dan više ne menja ništa. Nastavi sutra kao i obično."
    );
    // Zero-shame tone: no alarming vocabulary anywhere in the copy.
    const fullText = screen.getByTestId("home-ring").textContent ?? "";
    expect(fullText.toLowerCase()).not.toMatch(
      /greška|opasno|neuspeh|loše|kazna/
    );
  });

  it("test_AS_050_over_budget_drains_the_remaining_gauge_to_empty_never_a_broken_state", () => {
    render(<Ring consumedKcal={5000} targetKcal={2000} />);
    const arc = screen.getByTestId("home-ring-arc");
    // Nothing remaining -> the drained gauge is empty (offset = full 100).
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(100, 0);
    expect(arc.getAttribute("d")).toBeTruthy();
  });

  it("test_AS_050_the_gauge_never_switches_to_a_destructive_red_stroke_color_stays_the_single_accent", () => {
    render(<Ring consumedKcal={2300} targetKcal={2000} />);
    const arc = screen.getByTestId("home-ring-arc");
    expect(arc).toHaveAttribute("stroke", "var(--gauge)");
  });
});
