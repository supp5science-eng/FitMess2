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

  it("test_macro_remaining_view_shows_grams_left_but_the_ring_still_fills_by_consumed", () => {
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
    // The ring, though, fills by what's CONSUMED: 50/150 = 33.33% -> dash
    // offset 100 - 33.33 = 66.67.
    const fill = screen.getByTestId("macro-bar-protein-fill");
    expect(
      Number.parseFloat(fill.getAttribute("stroke-dashoffset") ?? "")
    ).toBeCloseTo(66.67, 1);
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
