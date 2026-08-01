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
    // An entry that already has a breakdown needs no split call. (Opening does
    // fetch the "nije bilo na slici" chips -- that read is unconditional.)
    const called = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => String(call[0])
    );
    expect(called.some((url) => url.includes("/razlozi"))).toBe(false);
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

// "Nije bilo na slici": the half of the sheet that adds a food the photo never
// contained. The chips are the whole interaction, so what matters is that a tap
// turns into something steppable and lands in the running total.
const MAYO = {
  id: "food-mayo",
  name_sr: "Majonez",
  kcal_100g: 687,
  protein_100g: 1.1,
  carbs_100g: 1.6,
  fat_100g: 75,
  fiber_100g: 0,
  sugar_100g: 1.6,
  sodium_100g: 600,
  sat_fat_100g: 11,
  unit_label: "kašika",
  unit_grams: 15,
  emoji: "🥄",
  label: "Majonez",
  of: "majoneza",
};

const PAVLAKA = { ...MAYO, id: "food-pavlaka", name_sr: "Pavlaka, kisela 18%", label: "Pavlaka", of: "pavlake", kcal_100g: 185 };

function mockExtras(extras: unknown[] = [MAYO, PAVLAKA]) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          String(url).includes("/api/dodaci")
            ? { ok: true, data: extras }
            : { ok: true, data: null }
        ),
    })
  );
}

describe("LogAddMoreSheet — nije bilo na slici", () => {
  it("turns a tapped chip into a stepper row and counts it toward the total", async () => {
    mockExtras();
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    const chip = await screen.findByTestId("log-add-more-chip-food-mayo");
    expect(chip).toHaveTextContent("Majonez");
    fireEvent.click(chip);

    // The chip is gone; a full stepper row stands in its place.
    expect(screen.queryByTestId("log-add-more-chip-food-mayo")).toBeNull();
    const row = screen.getByTestId("log-add-more-extra-food-mayo");
    // One tap says what it costs, in the unit a person uses.
    expect(row).toHaveTextContent("1 kašika · 15 g");
    expect(row).toHaveTextContent("103 kcal");

    // And it reads back in declined Serbian on the confirmation strip.
    expect(screen.getByTestId("log-add-more-preview")).toHaveTextContent(
      "1 kašika majoneza"
    );
  });

  it("steps a promoted extra back to zero and returns it to the chip row", async () => {
    mockExtras();
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    fireEvent.click(await screen.findByTestId("log-add-more-chip-food-mayo"));
    fireEvent.click(screen.getByTestId("log-add-more-extra-food-mayo-plus"));
    expect(screen.getByTestId("log-add-more-preview")).toHaveTextContent(
      "2 kašike majoneza"
    );

    fireEvent.click(screen.getByTestId("log-add-more-extra-food-mayo-minus"));
    fireEvent.click(screen.getByTestId("log-add-more-extra-food-mayo-minus"));
    expect(screen.queryByTestId("log-add-more-extra-food-mayo")).toBeNull();
    expect(screen.getByTestId("log-add-more-chip-food-mayo")).toBeInTheDocument();
  });

  it("hides a chip for a food the meal already contains", async () => {
    // baseLog's breakdown already has a "kisela pavlaka" line, which the
    // steppers above handle -- two controls for one food is how you double-log.
    mockExtras();
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));

    await screen.findByTestId("log-add-more-chip-food-mayo");
    expect(screen.queryByTestId("log-add-more-chip-food-pavlaka")).toBeNull();
  });

  it("sends only ids and unit counts, never a macro value", async () => {
    mockExtras();
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));
    fireEvent.click(await screen.findByTestId("log-add-more-chip-food-mayo"));
    fireEvent.click(screen.getByTestId("log-add-more-save"));

    await waitFor(() => {
      const save = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => String(call[0]).endsWith("/dodaj")
      );
      expect(save).toBeTruthy();
      expect(JSON.parse(String(save![1].body)).extras).toEqual([
        { foodId: "food-mayo", units: 1 },
      ]);
    });
  });
  it("closes from the X in the header", async () => {
    mockExtras();
    render(<LogAddMoreSheet log={baseLog} />);
    fireEvent.click(screen.getByTestId("log-add-more-open-log-1"));
    await screen.findByTestId("log-add-more-chip-food-mayo");

    // Tapping outside and Escape already worked, but neither is VISIBLE.
    fireEvent.click(screen.getByTestId("log-add-more-close"));
    expect(screen.queryByTestId("log-add-more-sheet")).toBeNull();
  });
});
