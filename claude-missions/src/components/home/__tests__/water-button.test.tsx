import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
