import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Dodaj još": the sheet that adds seconds to an existing entry. These cover
// the parts a user notices immediately -- can I get out of it, does it speak
// Serbian, does it ask for a breakdown when the entry has none.

vi.stubGlobal("fetch", vi.fn());

import { LogAddMoreSheet } from "@/components/food/log-add-more-sheet";
import type { Log } from "@/lib/types/db";

const baseLog: Log = {
  id: "log-1",
  user_id: "user-1",
  food_id: null,
  name: "Kajgana od 6 jaja sa kiselom pavlakom",
  grams: 360,
  kcal: 625,
  protein: 42,
  carbs: 6,
  fat: 47,
  fiber: null,
  sugar: null,
  sodium: null,
  sat_fat: null,
  components: [
    {
      naziv: "jaja",
      grami: 300,
      kcal: 450,
      protein_g: 36,
      uh_g: 3,
      mast_g: 33,
      kom_naziv: "jaje",
      kom_grami: 50,
    },
    {
      naziv: "kisela pavlaka",
      grami: 60,
      kcal: 175,
      protein_g: 6,
      uh_g: 3,
      mast_g: 14,
      kom_naziv: "kašika",
      kom_grami: 30,
    },
  ],
  logged_at: "2026-07-25T13:30:00.000Z",
  method: "meal",
  created_at: "2026-07-25T13:30:00.000Z",
};

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("LogAddMoreSheet", () => {
  it("opens on 'Dodaj još' and lists each food with what one tap adds", () => {
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    const eggs = screen.getByTestId("log-add-more-component-0");
    expect(eggs).toHaveTextContent("Jaja");
    // What is already there, and what "+" adds -- in declined Serbian.
    expect(eggs).toHaveTextContent("u obroku: 6 jaja");
    expect(eggs).toHaveTextContent("+1 jaje");

    expect(screen.getByTestId("log-add-more-component-1")).toHaveTextContent(
      "u obroku: 2 kašike"
    );
    // An entry that already has a breakdown needs no split call.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("closes when the dimmed area outside the panel is tapped", async () => {
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));
    expect(screen.getByTestId("log-add-more-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("log-add-more-overlay"));

    await waitFor(() =>
      expect(screen.queryByTestId("log-add-more-sheet")).not.toBeInTheDocument()
    );
  });

  it("stays open when the tap lands inside the panel", () => {
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    fireEvent.click(screen.getByTestId("log-add-more-sheet"));

    expect(screen.getByTestId("log-add-more-sheet")).toBeInTheDocument();
  });

  it("counts the taps and previews the added kcal, not the client's arithmetic", async () => {
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    fireEvent.click(screen.getByTestId("log-add-more-component-0-plus"));
    fireEvent.click(screen.getByTestId("log-add-more-component-0-plus"));
    fireEvent.click(screen.getByTestId("log-add-more-component-1-plus"));

    expect(screen.getByTestId("log-add-more-component-0-value")).toHaveTextContent(
      "2"
    );
    // 2 eggs (2 x 75 kcal) + 1 spoon (half of a 175 kcal line) = 238.
    // The figure counts up to it, so wait for the tween to land.
    await waitFor(() =>
      expect(screen.getByTestId("log-add-more-preview-kcal")).toHaveTextContent(
        "+238"
      )
    );
    expect(screen.getByText("+2 jajeta")).toBeInTheDocument();
    expect(screen.getByText("+1 kašika")).toBeInTheDocument();
  });

  it("asks for a breakdown when the entry has none, and falls back gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error_sr: "nope" }),
    });

    render(<LogAddMoreSheet log={{ ...baseLog, components: null }} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    expect(screen.getByTestId("log-add-more-splitting")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId("log-add-more-split-note")).toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/logs/log-1/razlozi", {
      method: "POST",
    });
    // Falls back to whole-entry seconds, pre-selected so the flow still works.
    expect(screen.getByTestId("log-add-more-whole-value")).toHaveTextContent("1");
  });
});
