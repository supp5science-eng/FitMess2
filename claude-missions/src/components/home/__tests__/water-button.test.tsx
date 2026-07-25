import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

import { WaterButton } from "@/components/home/water-button";

vi.stubGlobal("fetch", vi.fn());

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("WaterButton", () => {
  it("shows the day's initial total formatted in Serbian (liters with a comma)", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={1250} />);
    expect(screen.getByTestId("water-total")).toHaveTextContent("1,25 L");
  });

  it("shows small amounts in mL", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={250} />);
    expect(screen.getByTestId("water-total")).toHaveTextContent("250 mL");
  });

  it("spells the goal out as 'Dnevni cilj' and badges it once met", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={2500} goalMl={2500} />);
    expect(screen.getByTestId("water-total")).toHaveTextContent("2,5 L");
    expect(screen.getByTestId("water-goal")).toHaveTextContent(
      "Dnevni cilj: 2,5 L"
    );
    expect(screen.getByTestId("water-goal-reached")).toBeInTheDocument();
  });

  it("shows the goal but no reached badge below it", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={1000} goalMl={2500} />);
    expect(screen.getByTestId("water-total")).toHaveTextContent("1 L");
    expect(screen.getByTestId("water-goal")).toHaveTextContent(
      "Dnevni cilj: 2,5 L"
    );
    expect(
      screen.queryByTestId("water-goal-reached")
    ).not.toBeInTheDocument();
  });

  it("omits the goal entirely when none is provided", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={1250} />);
    expect(screen.getByTestId("water-total")).toHaveTextContent("1,25 L");
    expect(screen.queryByTestId("water-goal")).not.toBeInTheDocument();
  });

  it("draws the 7-day strip and moves the viewed day's bar as water is added", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", ml: 1250 } })
    );

    render(
      <WaterButton
        dayKey="2026-07-22"
        initialMl={0}
        goalMl={2500}
        week={[
          { label: "Sub", pct: 0.5, isToday: false },
          { label: "Ned", pct: 0, isToday: true },
        ]}
      />
    );

    const bars = screen.getByTestId("water-week-bars");
    expect(bars).toHaveTextContent("Sub");
    expect(bars).toHaveTextContent("Ned");

    fireEvent.click(screen.getByTestId("water-quick-250"));
    // 1250 of 2500 => the viewed day's bar is now at half height.
    await waitFor(() =>
      expect(
        within(bars).getAllByTestId("mini-week-bar")[1]
      ).toHaveStyle({ height: "50%" })
    );
  });

  it("a quick-add chip on the card posts its delta immediately, with no sheet", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", ml: 750 } })
    );

    render(<WaterButton dayKey="2026-07-22" initialMl={500} goalMl={2500} />);
    fireEvent.click(screen.getByTestId("water-quick-250"));

    await waitFor(() =>
      expect(screen.getByTestId("water-total")).toHaveTextContent("750 mL")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/voda",
      expect.objectContaining({
        body: JSON.stringify({ day: "2026-07-22", deltaMl: 250 }),
      })
    );
    expect(screen.queryByTestId("water-sheet")).not.toBeInTheDocument();
  });

  it("shows a Serbian error next to the chips when a quick-add fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("offline")
    );

    render(<WaterButton dayKey="2026-07-22" initialMl={500} goalMl={2500} />);
    fireEvent.click(screen.getByTestId("water-quick-500"));

    await waitFor(() =>
      expect(screen.getByTestId("water-quick-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("water-total")).toHaveTextContent("500 mL");
  });

  it("opens the sheet and quick-add presets accumulate into the amount", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={0} />);

    fireEvent.click(screen.getByTestId("water-open-button"));
    const input = screen.getByTestId("water-amount-input") as HTMLInputElement;
    expect(input.value).toBe("0");

    fireEvent.click(screen.getByTestId("water-preset-250"));
    fireEvent.click(screen.getByTestId("water-preset-500"));
    expect(input.value).toBe("750");
  });

  it("posts the accumulated delta and reflects the server's new total", async () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={500} />);

    fireEvent.click(screen.getByTestId("water-open-button"));
    fireEvent.click(screen.getByTestId("water-preset-750"));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", ml: 1250 } })
    );

    fireEvent.click(screen.getByTestId("water-save-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("water-sheet")).not.toBeInTheDocument()
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/voda",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ day: "2026-07-22", deltaMl: 750 }),
      })
    );
    expect(screen.getByTestId("water-total")).toHaveTextContent("1,25 L");
  });

  it("the − stepper composes a negative delta (undo) and posts it, flooring at empty-the-day", async () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={1500} />);

    fireEvent.click(screen.getByTestId("water-open-button"));
    const input = screen.getByTestId("water-amount-input") as HTMLInputElement;

    fireEvent.click(screen.getByTestId("water-minus-button"));
    fireEvent.click(screen.getByTestId("water-minus-button"));
    expect(input.value).toBe("-500");
    // Resulting day total previewed as 1500 - 500 = 1000 ("1 L").
    expect(screen.getByTestId("water-result-preview")).toHaveTextContent("1 L");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { day: "2026-07-22", ml: 1000 } })
    );
    fireEvent.click(screen.getByTestId("water-save-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("water-sheet")).not.toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/voda",
      expect.objectContaining({
        body: JSON.stringify({ day: "2026-07-22", deltaMl: -500 }),
      })
    );
    expect(screen.getByTestId("water-total")).toHaveTextContent("1 L");
  });

  it("cannot remove more than the day holds (− stepper floors at −total, then disables)", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={250} />);

    fireEvent.click(screen.getByTestId("water-open-button"));
    const input = screen.getByTestId("water-amount-input") as HTMLInputElement;

    fireEvent.click(screen.getByTestId("water-minus-button"));
    expect(input.value).toBe("-250");
    // Already at empty-the-day floor -> further removal is blocked.
    expect(screen.getByTestId("water-minus-button")).toBeDisabled();
  });

  it("does nothing when the amount is 0 (Unesi disabled)", () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={0} />);
    fireEvent.click(screen.getByTestId("water-open-button"));
    expect(screen.getByTestId("water-save-button")).toBeDisabled();
  });

  it("shows an error when the save fails", async () => {
    render(<WaterButton dayKey="2026-07-22" initialMl={0} />);

    fireEvent.click(screen.getByTestId("water-open-button"));
    fireEvent.click(screen.getByTestId("water-preset-250"));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Nismo uspeli da sačuvamo vodu. Pokušaj ponovo." }, false)
    );

    fireEvent.click(screen.getByTestId("water-save-button"));

    await waitFor(() =>
      expect(screen.getByTestId("water-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("water-sheet")).toBeInTheDocument();
  });
});
