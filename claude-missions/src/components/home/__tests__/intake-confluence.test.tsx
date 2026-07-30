import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { IntakeConfluence } from "@/components/home/intake-confluence";

// Layout redesign 2026-07-30 ("Cal AI"): the calorie card now reads
// left-to-right -- the big number is the metric the toggle selected, with its
// tappable "Preostalo / Potrošeno" label beneath it, and a flame ring on the
// right. Cilj + Potrošeno stay in the DOM (accessible + tested) but are no longer
// a visible three-number row. These tests lock: the number shows the selected
// metric, the toggle flips it, and the fixed values stay wired to their metric.

const consumedMacros = { protein: 60, carbs: 120, fat: 30 };
const targetMacros = { proteinG: 150, carbsG: 200, fatG: 60 };

function renderConfluence(consumedKcal: number, targetKcal: number) {
  return render(
    <IntakeConfluence
      consumedKcal={consumedKcal}
      targetKcal={targetKcal}
      consumedMacros={consumedMacros}
      targetMacros={targetMacros}
    />
  );
}

describe("IntakeConfluence: the big number is the selected metric, values stay wired", () => {
  it("test_the_card_shows_remaining_by_default_with_cilj_and_potroseno_wired", () => {
    renderConfluence(1200, 2000);

    // Default view is "remaining": the big number and its label say so.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("800");
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent("Preostalo");

    // Cilj + Potrošeno stay in the DOM tied to their own metric.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
  });

  it("test_tapping_the_potroseno_segment_flips_the_number", async () => {
    renderConfluence(1200, 2000);

    fireEvent.click(screen.getByRole("button", { name: "Potrošeno" }));

    await waitFor(() =>
      expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1200")
    );
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent("Potrošeno");

    // The wired values never move off their metric when the view flips.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
  });

  it("test_the_preostalo_arc_shows_what_is_left_not_a_permanently_full_circle", () => {
    // The reported bug: at 1000 of 3000 kcal the "Preostalo" ring drew a full
    // circle, identical to an untouched day, while the number said 2000. The
    // arc must report the same two thirds the number does.
    renderConfluence(1000, 3000);

    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("2000");
    const arc = screen.getByTestId("home-ring-arc");
    // 2000 of 3000 left = 66.67% of the ring -> dash offset 100 - 66.67.
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(33.33, 1);
  });

  it("test_the_two_views_draw_complementary_arcs_for_the_same_day", () => {
    renderConfluence(1000, 3000);

    const offsetFor = () =>
      Number(screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset"));

    // "Preostalo": two thirds left.
    const remainingOffset = offsetFor();
    fireEvent.click(screen.getByRole("button", { name: "Potrošeno" }));
    // "Potrošeno": one third eaten. The two arcs must add up to the whole ring,
    // which is exactly what "the same day seen from both sides" means.
    const consumedOffset = offsetFor();

    expect(remainingOffset).toBeCloseTo(33.33, 1);
    expect(consumedOffset).toBeCloseTo(66.67, 1);
    expect(200 - remainingOffset - consumedOffset).toBeCloseTo(100, 1);
  });

  it("test_an_untouched_day_is_a_full_preostalo_ring_and_an_empty_potroseno_one", () => {
    // The one case where a full circle IS right: nothing eaten yet.
    renderConfluence(0, 3000);

    expect(
      Number(screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(0, 1);

    fireEvent.click(screen.getByRole("button", { name: "Potrošeno" }));
    expect(
      Number(screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(100, 1);
  });

  it("test_over_budget_drains_the_preostalo_arc_to_empty_and_keeps_the_red_lap", () => {
    renderConfluence(2500, 2000);

    // Nothing is left, so the blue arc is empty rather than misleadingly full.
    expect(
      Number(screen.getByTestId("home-ring-arc").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(100, 1);
    // The overshoot lap still tells how far past the budget the day went:
    // 500 over 2000 = 25% -> dash offset 75.
    expect(
      Number(
        screen
          .getByTestId("home-ring-overshoot-arc")
          .getAttribute("stroke-dashoffset")
      )
    ).toBeCloseTo(75, 1);
  });

  it("test_over_budget_keeps_the_negative_remaining_and_the_calm_note", () => {
    renderConfluence(2500, 2000);

    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("-500");
    expect(screen.getByTestId("home-ring-overshoot-note")).toHaveTextContent(
      "preko cilja"
    );
    expect(screen.getByTestId("home-ring")).toHaveAttribute(
      "aria-label",
      "Prekoračeno 500 kcal"
    );
  });
});
