import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// F028 / AS-051: proves `/dodaj/uskoro/[metoda]` -- the destination
// `AddSheet`'s not-yet-built method rows link to -- always renders a real,
// clear Serbian "coming soon" page (never a blank/broken screen, matching
// the clarified failure-handling answer), for every known method AND for
// an unrecognized one (defensive fallback).

import UskoroPage from "../page";

describe("AS-051: /dodaj/uskoro/[metoda] renders method-specific Serbian copy, never a broken screen", () => {
  it("test_AS_051_barkod_renders_its_own_uskoro_copy", async () => {
    const ui = await UskoroPage({ params: Promise.resolve({ metoda: "barkod" }) });
    render(ui);

    expect(screen.getByTestId("uskoro-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Skeniranje barkoda" })
    ).toBeInTheDocument();
  });

  it("test_AS_051_deklaracija_renders_its_own_uskoro_copy", async () => {
    const ui = await UskoroPage({
      params: Promise.resolve({ metoda: "deklaracija" }),
    });
    render(ui);

    expect(
      screen.getByRole("heading", { name: "Slikanje deklaracije" })
    ).toBeInTheDocument();
  });

  it("test_AS_051_obrok_renders_its_own_uskoro_copy", async () => {
    const ui = await UskoroPage({ params: Promise.resolve({ metoda: "obrok" }) });
    render(ui);

    expect(
      screen.getByRole("heading", { name: "Slikanje obroka" })
    ).toBeInTheDocument();
  });

  it("test_AS_051_an_unrecognized_metoda_still_renders_a_friendly_fallback_not_a_crash", async () => {
    const ui = await UskoroPage({
      params: Promise.resolve({ metoda: "nesto-nepoznato" }),
    });
    render(ui);

    expect(screen.getByTestId("uskoro-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Uskoro dostupno" })
    ).toBeInTheDocument();
  });

  it("test_AS_051_offers_a_real_link_back_to_the_active_search_flow", async () => {
    const ui = await UskoroPage({ params: Promise.resolve({ metoda: "barkod" }) });
    render(ui);

    expect(
      screen.getByRole("link", { name: "Pretraži hranu" })
    ).toHaveAttribute("href", "/dodaj/pretraga");
  });
});
