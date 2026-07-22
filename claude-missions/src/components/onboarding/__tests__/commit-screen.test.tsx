import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { CommitScreen } from "../commit-screen";
import type { CommitmentInput } from "@/lib/onboarding/commitment";

const DATA: CommitmentInput = {
  goal: "lose",
  sex: "male",
  weightKg: 80,
  targetWeightKg: 74,
  timeframeWeeks: 8,
};

describe("CommitScreen", () => {
  it("opens on the intro beat, then reveals the personalized pledge", () => {
    render(<CommitScreen data={DATA} onCommitted={() => {}} />);

    // Intro beat.
    expect(screen.getByRole("heading", { name: /Sve je spremno/ })).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /Nastavi/ });
    fireEvent.click(next);

    // Hold beat: personalized commitment + the hold control.
    expect(screen.getByText(/Obećavam sebi da ću/)).toBeInTheDocument();
    expect(screen.getByText(/smršati 6 kg/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pritisni i drži/ })
    ).toBeInTheDocument();
  });

  it("keyboard activation commits, celebrates, then auto-advances", () => {
    vi.useFakeTimers();
    try {
      const onCommitted = vi.fn();
      render(<CommitScreen data={DATA} onCommitted={onCommitted} />);
      fireEvent.click(screen.getByRole("button", { name: /Nastavi/ }));

      // fireEvent.click reports detail 0 with no preceding pointer gesture,
      // i.e. the keyboard/AT path.
      fireEvent.click(screen.getByRole("button", { name: /Pritisni i drži/ }));

      expect(screen.getByText(/Posvećeno/)).toBeInTheDocument();
      expect(onCommitted).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2400);
      });
      expect(onCommitted).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
