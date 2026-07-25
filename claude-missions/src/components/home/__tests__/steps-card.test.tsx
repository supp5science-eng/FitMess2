import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";

import { StepsCard } from "@/components/home/steps-card";

vi.stubGlobal("fetch", vi.fn());

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("StepsCard", () => {
  it("shows the day's initial step total with a Serbian thousands separator", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={7240} />);
    expect(screen.getByTestId("steps-total")).toHaveTextContent("7.240");
  });

  it("shows a 'goal reached' badge once the total hits the daily goal", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={10500} />);
    expect(screen.getByTestId("steps-goal-reached")).toBeInTheDocument();
  });

  it("hides the 'goal reached' badge below the goal", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={5000} />);
    expect(screen.queryByTestId("steps-goal-reached")).not.toBeInTheDocument();
  });

  it("spells the daily goal out instead of printing '0 / 10.000'", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={0} goal={10000} />);
    expect(screen.getByTestId("steps-goal")).toHaveTextContent(
      "Dnevni cilj: 10.000"
    );
  });

  it("draws the 7-day strip and moves the viewed day's bar as steps are added", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", steps: 5000 } })
    );

    render(
      <StepsCard
        dayKey="2026-07-22"
        initialSteps={0}
        goal={10000}
        week={[
          { label: "Sub", pct: 1, isToday: false },
          { label: "Ned", pct: 0, isToday: true },
        ]}
      />
    );

    const bars = screen.getByTestId("steps-week-bars");
    expect(bars).toHaveTextContent("Sub");

    fireEvent.click(screen.getByTestId("steps-quick-3000"));
    // 5.000 of 10.000 => the viewed day's bar is now at half height.
    await waitFor(() =>
      expect(within(bars).getAllByTestId("mini-week-bar")[1]).toHaveStyle({
        height: "50%",
      })
    );
  });

  it("a quick-add chip on the card posts its delta immediately, with no sheet", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", steps: 3000 } })
    );

    render(<StepsCard dayKey="2026-07-22" initialSteps={2000} />);
    fireEvent.click(screen.getByTestId("steps-quick-1000"));

    await waitFor(() =>
      expect(screen.getByTestId("steps-total")).toHaveTextContent("3.000")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/koraci",
      expect.objectContaining({
        body: JSON.stringify({ day: "2026-07-22", deltaSteps: 1000 }),
      })
    );
    // The sheet was never involved.
    expect(screen.queryByTestId("steps-sheet")).not.toBeInTheDocument();
  });

  it("shows a Serbian error next to the chips when a quick-add fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("offline")
    );

    render(<StepsCard dayKey="2026-07-22" initialSteps={2000} />);
    fireEvent.click(screen.getByTestId("steps-quick-500"));

    await waitFor(() =>
      expect(screen.getByTestId("steps-quick-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("steps-total")).toHaveTextContent("2.000");
  });

  it("opens the sheet and quick-add presets accumulate into the pending amount", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={0} />);

    fireEvent.click(screen.getByTestId("steps-open-button"));
    const input = screen.getByTestId("steps-amount-input") as HTMLInputElement;
    expect(input.value).toBe("0");

    fireEvent.click(screen.getByTestId("steps-preset-1000"));
    fireEvent.click(screen.getByTestId("steps-preset-3000"));
    expect(input.value).toBe("4000");

    // The live ring total reflects current + pending.
    expect(screen.getByTestId("steps-sheet-total")).toHaveTextContent("4.000");
  });

  it("the − stepper can walk a mistap back but never below zero for the day", () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={0} />);
    fireEvent.click(screen.getByTestId("steps-open-button"));

    // With 0 logged, the minus stepper is disabled (can't go negative).
    expect(screen.getByTestId("steps-minus-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("steps-preset-1000"));
    fireEvent.click(screen.getByTestId("steps-minus-button")); // -500
    expect(
      (screen.getByTestId("steps-amount-input") as HTMLInputElement).value
    ).toBe("500");
  });

  it("posts the accumulated delta and reflects the server's new total", async () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={2000} />);

    fireEvent.click(screen.getByTestId("steps-open-button"));
    fireEvent.click(screen.getByTestId("steps-preset-3000"));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", steps: 5000 } })
    );

    fireEvent.click(screen.getByTestId("steps-save-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("steps-sheet")).not.toBeInTheDocument()
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/koraci",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ day: "2026-07-22", deltaSteps: 3000 }),
      })
    );
    expect(screen.getByTestId("steps-total")).toHaveTextContent("5.000");
  });

  it("holding the − stepper auto-repeats (accelerating) and stops on release", () => {
    vi.useFakeTimers();
    try {
      render(<StepsCard dayKey="2026-07-22" initialSteps={9000} />);
      fireEvent.click(screen.getByTestId("steps-open-button"));
      // Build up a big pending amount so − has plenty of room to run.
      fireEvent.click(screen.getByTestId("steps-preset-3000"));
      const value = () =>
        (screen.getByTestId("steps-amount-input") as HTMLInputElement).value;
      expect(value()).toBe("3000");

      // Press and hold the minus stepper: many −500 repeats should fire.
      fireEvent.pointerDown(screen.getByTestId("steps-minus-button"));
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      // Well past the single-tap result (2500) — the hold repeated.
      const afterHold = Number(value());
      expect(afterHold).toBeLessThan(2000);

      // Release stops it: further time doesn't change the amount.
      act(() => {
        window.dispatchEvent(new Event("pointerup"));
      });
      const settled = value();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(value()).toBe(settled);
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a Serbian error and keeps the sheet open when the save fails", async () => {
    render(<StepsCard dayKey="2026-07-22" initialSteps={0} />);
    fireEvent.click(screen.getByTestId("steps-open-button"));
    fireEvent.click(screen.getByTestId("steps-preset-1000"));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Nismo uspeli da sačuvamo korake. Pokušaj ponovo." }, false)
    );

    fireEvent.click(screen.getByTestId("steps-save-button"));

    await waitFor(() =>
      expect(screen.getByTestId("steps-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("steps-sheet")).toBeInTheDocument();
  });
});
