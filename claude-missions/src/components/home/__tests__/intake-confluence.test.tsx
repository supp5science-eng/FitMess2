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

  it("test_tapping_the_label_toggle_flips_the_number_to_potroseno", async () => {
    renderConfluence(1200, 2000);

    fireEvent.click(screen.getByTestId("home-view-toggle"));

    await waitFor(() =>
      expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1200")
    );
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent("Potrošeno");

    // The wired values never move off their metric when the view flips.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
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
