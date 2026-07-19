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

  it("test_AS_048_bar_fill_width_reflects_the_consumed_over_target_ratio", () => {
    render(
      <MacroBars
        consumed={{ protein: 75, carbs: 0, fat: 0 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
      />
    );

    const fill = screen.getByTestId("macro-bar-protein-fill");
    expect(fill).toHaveStyle({ width: "50%" });
  });

  it("test_macro_remaining_view_shows_grams_left_and_fills_by_the_remaining_ratio", () => {
    render(
      <MacroBars
        consumed={{ protein: 50, carbs: 100, fat: 30 }}
        target={{ proteinG: 150, carbsG: 200, fatG: 60 }}
        view="remaining"
      />
    );

    // Protein: 150 - 50 = 100 g left -> "100 / 150 g", bar 100/150 = 66.67%.
    expect(screen.getByTestId("macro-bar-protein-values")).toHaveTextContent(
      "100 / 150 g"
    );
    const fill = screen.getByTestId("macro-bar-protein-fill");
    expect(Number.parseFloat(fill.style.width)).toBeCloseTo(66.67, 1);
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
    expect(screen.getByTestId("macro-bar-protein-fill")).toHaveStyle({
      width: "100%",
    });
  });
});
