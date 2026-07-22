import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AnimatedNumber } from "@/components/home/animated-number";

describe("AnimatedNumber", () => {
  it("shows the value immediately on first mount (no count-up from zero on load)", () => {
    render(<AnimatedNumber value={1800} data-testid="n" />);
    // Synchronously, before any animation frame, the real value is present.
    expect(screen.getByTestId("n")).toHaveTextContent("1800");
  });

  it("rounds the displayed value", () => {
    render(<AnimatedNumber value={66.7} data-testid="n" />);
    expect(screen.getByTestId("n")).toHaveTextContent("67");
  });

  it("passes through className and other span props", () => {
    render(
      <AnimatedNumber value={5} data-testid="n" className="tabular-nums" />
    );
    expect(screen.getByTestId("n")).toHaveClass("tabular-nums");
  });

  it("snaps instantly when the value changes but animateKey does not (e.g. a meal edit)", () => {
    const { rerender } = render(
      <AnimatedNumber value={800} animateKey="remaining" data-testid="n" />
    );
    rerender(
      <AnimatedNumber value={1000} animateKey="remaining" data-testid="n" />
    );
    // Same key -> no tween -> the new value is present synchronously.
    expect(screen.getByTestId("n")).toHaveTextContent("1000");
  });

  it("animates and converges on the new value when animateKey changes (the toggle)", async () => {
    const { rerender } = render(
      <AnimatedNumber
        value={800}
        animateKey="remaining"
        durationMs={40}
        data-testid="n"
      />
    );
    expect(screen.getByTestId("n")).toHaveTextContent("800");

    rerender(
      <AnimatedNumber
        value={200}
        animateKey="consumed"
        durationMs={40}
        data-testid="n"
      />
    );
    // The tween settles on exactly the new target.
    await waitFor(
      () => expect(screen.getByTestId("n")).toHaveTextContent("200"),
      { timeout: 2000 }
    );
  });
});
