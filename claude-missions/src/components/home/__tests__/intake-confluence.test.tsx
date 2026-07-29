import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { IntakeConfluence } from "@/components/home/intake-confluence";

// Layout redesign 2026-07-29 (the product owner's call: "brojke oko prstena
// nisu lepo raspoređene i kartica loše izgleda"). Cilj and the alternate metric
// used to be absolutely positioned to the LEFT and RIGHT of the dial inside the
// confluence SVG box, which pushed the ring off the card's optical centre and
// left nothing aligned with the macro tiles underneath.
//
// Now: the dial holds ONE number (whichever the toggle selected) and all three
// numbers live in a ruled three-column row beneath it, on the same grid as the
// macro tiles. These tests lock the two properties that redesign has to keep --
// the dial shows the selected metric, and NOTHING moves between views.

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

describe("IntakeConfluence: one number in the dial, all three in the row below", () => {
  it("test_the_row_carries_cilj_potroseno_and_preostalo_at_once", () => {
    renderConfluence(1200, 2000);

    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("800");
    expect(screen.getByTestId("home-ring-label")).toHaveTextContent("Preostalo");
  });

  it("test_the_dial_itself_shows_only_the_selected_metric", () => {
    renderConfluence(1200, 2000);

    // The row sits OUTSIDE the `role="img"` dial, so what is inside the dial is
    // exactly the promoted number -- and the other two are not.
    const dial = within(screen.getByTestId("home-ring"));
    expect(dial.getByText("800")).toBeInTheDocument();
    expect(dial.queryByText("1200")).not.toBeInTheDocument();
    expect(dial.queryByText("2000")).not.toBeInTheDocument();
    // No label under the centre number any more: the toggle above and the
    // highlighted column below name it.
    expect(dial.queryByText("Preostalo")).not.toBeInTheDocument();
  });

  it("test_switching_the_view_moves_the_dial_number_but_not_the_row", async () => {
    renderConfluence(1200, 2000);

    fireEvent.click(screen.getByRole("button", { name: "Potrošeno" }));

    await waitFor(() =>
      expect(
        within(screen.getByTestId("home-ring")).getByText("1200")
      ).toBeInTheDocument()
    );

    // Every number is still present, in its own fixed slot -- nothing jumps
    // between columns and no test id follows the toggle around.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
    expect(screen.getByTestId("home-ring-consumed")).toHaveTextContent("1200");
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("800");
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
