import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// F031: proves `/dodaj/novi-proizvod` -- the destination `ScanScreen`
// routes to on a barcode-lookup MISS -- always renders a real, non-blank
// Serbian screen AND carries the scanned GTIN through the query string
// (F032's own contract requirement), never silently dropping it.

import NoviProizvodPage from "../page";

describe("F031: /dodaj/novi-proizvod carries the scanned GTIN and never renders blank", () => {
  it("test_the_scanned_gtin_from_the_query_string_is_shown_on_the_page", async () => {
    const ui = await NoviProizvodPage({
      searchParams: Promise.resolve({ barkod: "5901234123457" }),
    });
    render(ui);

    expect(screen.getByTestId("novi-proizvod-page")).toBeInTheDocument();
    expect(screen.getByTestId("novi-proizvod-gtin")).toHaveTextContent(
      "5901234123457"
    );
  });

  it("test_a_missing_gtin_still_renders_a_friendly_screen_not_a_crash", async () => {
    const ui = await NoviProizvodPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByTestId("novi-proizvod-page")).toBeInTheDocument();
    expect(screen.queryByTestId("novi-proizvod-gtin")).not.toBeInTheDocument();
  });

  it("test_offers_a_real_link_back_to_the_active_search_flow", async () => {
    const ui = await NoviProizvodPage({
      searchParams: Promise.resolve({ barkod: "5901234123457" }),
    });
    render(ui);

    expect(
      screen.getByRole("link", { name: "Pretraži hranu" })
    ).toHaveAttribute("href", "/dodaj/pretraga");
  });
});
