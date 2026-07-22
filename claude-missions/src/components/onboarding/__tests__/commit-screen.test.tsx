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
  it("shows the personalized pledge and a hold-to-commit control", () => {
    render(<CommitScreen data={DATA} onCommitted={() => {}} />);
    expect(
      screen.getByText(/Posvećen sam svom cilju/)
    ).toBeInTheDocument();
    expect(screen.getByText(/smršam 6 kg/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pritisni i drži/ })
    ).toBeInTheDocument();
  });

  it("keyboard activation commits, celebrates, then auto-advances", () => {
    vi.useFakeTimers();
    try {
      const onCommitted = vi.fn();
      render(<CommitScreen data={DATA} onCommitted={onCommitted} />);

      // fireEvent.click reports detail 0 with no preceding pointer gesture,
      // i.e. the keyboard/AT path.
      fireEvent.click(screen.getByRole("button", { name: /Pritisni i drži/ }));

      expect(screen.getByText(/Posvećeno/)).toBeInTheDocument();
      expect(onCommitted).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2200);
      });
      expect(onCommitted).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
