import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
    fireEvent.click(screen.getByTestId("steps-preset-6000"));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", steps: 8000 } })
    );

    fireEvent.click(screen.getByTestId("steps-save-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("steps-sheet")).not.toBeInTheDocument()
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/koraci",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ day: "2026-07-22", deltaSteps: 6000 }),
      })
    );
    expect(screen.getByTestId("steps-total")).toHaveTextContent("8.000");
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
