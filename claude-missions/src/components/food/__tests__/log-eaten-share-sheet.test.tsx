import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Nisam sve pojeo": the meal card's middle button. What matters is that it
// defaults to the plate the entry actually claims, that it can be undone, and
// that only a percentage ever goes over the wire.

vi.stubGlobal("fetch", vi.fn());

import { LogEatenShareSheet } from "@/components/food/log-eaten-share-sheet";
import type { Log } from "@/lib/types/db";

const baseLog: Log = {
  id: "log-1",
  user_id: "user-1",
  food_id: null,
  name: "Ćevapi sa lepinjom",
  grams: 400,
  kcal: 980,
  protein: 44,
  carbs: 61,
  fat: 38,
  fiber: null,
  sugar: null,
  sodium: null,
  sat_fat: null,
  components: null,
  logged_at: "2026-08-01T13:30:00.000Z",
  method: "meal",
  created_at: "2026-08-01T13:30:00.000Z",
};

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("LogEatenShareSheet", () => {
  it("opens at the whole plate for an entry nobody has trimmed", () => {
    render(<LogEatenShareSheet log={baseLog} />);
    const trigger = screen.getByTestId("log-eaten-open-log-1");
    // Before opening, the button asks rather than reports.
    expect(trigger).toHaveTextContent("Koliko si pojeo");

    fireEvent.click(trigger);
    expect(screen.getByTestId("eaten-share-value")).toHaveTextContent("100%");
    // A catalog entry was never photographed, so the question doesn't pretend
    // there is a picture of it.
    expect(screen.getByTestId("eaten-share")).toHaveTextContent(
      "Koliko si pojeo/la od celog obroka?"
    );
    // Nothing left behind, so no leftovers line.
    expect(screen.queryByTestId("eaten-share-left")).toBeNull();
  });

  it("previews the smaller meal as the thumb moves", async () => {
    render(<LogEatenShareSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));

    fireEvent.change(screen.getByTestId("eaten-share-range"), {
      target: { value: "40" },
    });

    expect(screen.getByTestId("eaten-share-value")).toHaveTextContent("40%");
    // 40% of 980 kcal / 400 g -- the readout is what the entry BECOMES.
    const card = screen.getByTestId("eaten-share");
    await waitFor(() => expect(card).toHaveTextContent("392 kcal"));
    expect(card).toHaveTextContent("160 g");
    // And it says what was left rather than only what was eaten.
    expect(screen.getByTestId("eaten-share-left")).toHaveTextContent("588");
  });

  it("sends only a percentage — the server recomputes every macro", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { ...baseLog, kcal: 392, grams: 160, eaten_share: 40 },
      }),
    });
    const onSaved = vi.fn();

    render(<LogEatenShareSheet log={baseLog} onSaved={onSaved} />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    fireEvent.change(screen.getByTestId("eaten-share-range"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByTestId("log-eaten-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toBe("/api/logs/log-1/pojedeno");
    expect(JSON.parse(String(call[1].body))).toEqual({ share: 40 });
    // The sheet closes on success, and the button now REPORTS the state.
    expect(screen.queryByTestId("log-eaten-sheet")).toBeNull();
    expect(screen.getByTestId("log-eaten-open-log-1")).toHaveTextContent(
      "Pojedeno 40%"
    );
  });

  it("names the photo when there is one", () => {
    render(<LogEatenShareSheet log={baseLog} hasPhoto />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    expect(screen.getByTestId("eaten-share")).toHaveTextContent(
      "Koliko si pojeo/la od celog slikanog obroka?"
    );
  });

  it("reopens on the entry's own share, so a mistaken cut can be undone", () => {
    // The whole reason 0025 stores the ratio: without it, a slider that always
    // reopened at 100% would leave no way back from a mistaken 30%.
    render(<LogEatenShareSheet log={{ ...baseLog, eaten_share: 30 }} />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    expect(screen.getByTestId("eaten-share-value")).toHaveTextContent("30%");
  });

  it("says so when saving fails, and keeps the sheet open", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error_sr: "Unos više ne postoji." }),
    });

    render(<LogEatenShareSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    fireEvent.click(screen.getByTestId("log-eaten-save"));

    expect(await screen.findByTestId("log-eaten-error")).toHaveTextContent(
      "Unos više ne postoji."
    );
    expect(screen.getByTestId("log-eaten-sheet")).toBeInTheDocument();
  });

  it("closes from the dimmed area and from the X", async () => {
    render(<LogEatenShareSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    fireEvent.click(screen.getByTestId("log-eaten-overlay"));
    await waitFor(() =>
      expect(screen.queryByTestId("log-eaten-sheet")).toBeNull()
    );

    fireEvent.click(screen.getByTestId("log-eaten-open-log-1"));
    fireEvent.click(screen.getByTestId("log-eaten-close"));
    expect(screen.queryByTestId("log-eaten-sheet")).toBeNull();
  });
});
