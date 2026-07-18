import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Ring } from "@/components/home/ring";

describe("AS-047: Ring shows today's remaining calories, centered", () => {
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

  it("test_AS_047_the_progress_arc_reflects_consumed_over_target_as_a_partial_ring", () => {
    render(<Ring consumedKcal={1000} targetKcal={2000} />);
    const arc = screen.getByTestId("home-ring-arc");
    const circumference = Number(arc.getAttribute("stroke-dasharray"));
    const offset = Number(arc.getAttribute("stroke-dashoffset"));
    // 50% consumed -> offset should be roughly half the circumference.
    expect(offset).toBeCloseTo(circumference * 0.5, 0);
  });
});

describe("AS-050: overshoot state is calm, neutral, and the ring stays functional", () => {
  it("test_AS_050_consumed_exceeding_target_switches_the_center_copy_to_prekoraceno_with_the_overshoot_amount", () => {
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

  it("test_AS_050_the_ring_arc_still_renders_a_completed_ring_never_a_broken_or_empty_state", () => {
    render(<Ring consumedKcal={5000} targetKcal={2000} />);
    const arc = screen.getByTestId("home-ring-arc");
    const circumference = Number(arc.getAttribute("stroke-dasharray"));
    const offset = Number(arc.getAttribute("stroke-dashoffset"));
    // Fully filled ring (100%), never overflowing past a full circle.
    expect(offset).toBeCloseTo(0, 0);
    expect(circumference).toBeGreaterThan(0);
  });

  it("test_AS_050_the_ring_never_switches_to_a_destructive_red_stroke_color_stays_the_single_green_accent", () => {
    render(<Ring consumedKcal={2300} targetKcal={2000} />);
    const arc = screen.getByTestId("home-ring-arc");
    expect(arc).toHaveAttribute("stroke", "var(--primary)");
  });
});
