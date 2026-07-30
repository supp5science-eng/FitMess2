import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MacroBars } from "@/components/home/macro-bars";

describe("AS-048: MacroBars shows protein/carbs/fat consumed vs target", () => {
  it("test_AS_048_renders_all_three_bars_with_serbian_labels", () => {
    render(
      <MacroBars
        consumed={{ protein: 50, carbs: 100, fat: 30 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );

    expect(screen.getByTestId("macro-bar-protein")).toHaveTextContent(
      "Proteini"
    );
    expect(screen.getByTestId("macro-bar-carbs")).toHaveTextContent("UH");
    expect(screen.getByTestId("macro-bar-fat")).toHaveTextContent("Masti");
  });

  it("test_AS_048_shows_the_correct_consumed_over_target_gram_values_for_each_macro", () => {
    render(
      <MacroBars
        consumed={{ protein: 50, carbs: 100, fat: 30 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );

    expect(screen.getByTestId("macro-bar-protein-values")).toHaveTextContent(
      "50 / 150 g"
    );
    expect(screen.getByTestId("macro-bar-carbs-values")).toHaveTextContent(
      "100 / 200 g"
    );
    expect(screen.getByTestId("macro-bar-fat-values")).toHaveTextContent(
      "30 / 60 g"
    );
  });

  it("test_AS_048_ring_fill_reflects_the_consumed_over_target_ratio", () => {
    render(
      <MacroBars
        consumed={{ protein: 75, carbs: 0, fat: 0 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );

    // 75 / 150 = 50% filled -> the ring arc's dash offset is 100 - 50 = 50.
    const fill = screen.getByTestId("macro-bar-protein-fill");
    expect(fill.getAttribute("stroke-dashoffset")).toBe("50");
  });

  it("test_macro_remaining_view_shows_grams_left_and_a_ring_drained_to_match", () => {
    render(
      <MacroBars
        consumed={{ protein: 50, carbs: 100, fat: 30 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
        view="remaining"
      />
    );

    // The number shows what's LEFT: 150 - 50 = 100 g -> "100 / 150 g".
    expect(screen.getByTestId("macro-bar-protein-values")).toHaveTextContent(
      "100 / 150 g"
    );
    // ...and the ring shows the SAME thing: 100 of 150 g left is two thirds of
    // the allowance, so the arc stands at 66.67% -> dash offset 100 - 66.67.
    // It used to be pinned to a full circle here, which meant all three macro
    // rings looked untouched no matter how much of each was actually gone.
    const fill = screen.getByTestId("macro-bar-protein-fill");
    expect(Number(fill.getAttribute("stroke-dashoffset"))).toBeCloseTo(33.33, 1);
  });

  it("test_each_macro_ring_drains_by_its_own_share_not_all_alike", () => {
    // The bug's signature was three identical full rings. Three macros eaten to
    // three different degrees must therefore land on three different arcs.
    render(
      <MacroBars
        consumed={{ protein: 150, carbs: 100, fat: 0 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
        view="remaining"
      />
    );

    // Protein fully eaten -> nothing left -> empty arc (offset 100).
    expect(
      Number(screen.getByTestId("macro-bar-protein-fill").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(100, 1);
    // Carbs half eaten -> half left -> half arc.
    expect(
      Number(screen.getByTestId("macro-bar-carbs-fill").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(50, 1);
    // Fat untouched -> all of it left -> full arc.
    expect(
      Number(screen.getByTestId("macro-bar-fat-fill").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(0, 1);
  });

  it("test_a_macro_eaten_past_its_target_drains_to_empty_rather_than_going_negative", () => {
    render(
      <MacroBars
        consumed={{ protein: 200, carbs: 0, fat: 0 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
        view="remaining"
      />
    );

    // 200 of 150 g eaten: nothing is left, so the arc is empty (offset 100) --
    // never a negative fraction that would wrap the stroke back around.
    expect(
      Number(screen.getByTestId("macro-bar-protein-fill").getAttribute("stroke-dashoffset"))
    ).toBeCloseTo(100, 1);
  });

  it("test_AS_048_a_macro_consumed_beyond_its_target_still_shows_the_real_number_bar_capped_at_100_percent", () => {
    render(
      <MacroBars
        consumed={{ protein: 200, carbs: 0, fat: 0 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );

    expect(screen.getByTestId("macro-bar-protein-values")).toHaveTextContent(
      "200 / 150 g"
    );
    // 200/150 caps at 100% filled -> dash offset 0.
    expect(
      screen.getByTestId("macro-bar-protein-fill").getAttribute("stroke-dashoffset")
    ).toBe("0");
  });
});
