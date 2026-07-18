import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F032 / AS-055: `/dodaj/novi-proizvod` -- the destination `ScanScreen`
// (F031) routes to on a barcode-lookup MISS -- renders the real first-time
// product entry form (`NewProductForm`), pre-filled with the scanned GTIN
// carried through the query string, and never a blank/broken screen when no
// GTIN is present (a direct/bookmarked visit).
//
// `NewProductForm` itself (validation, save, duplicate-barcode handling) is
// covered directly by
// `src/components/food/__tests__/new-product-form.test.tsx` -- this file
// only proves the SERVER page reads/passes the query param correctly and
// always renders real content.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import NoviProizvodPage from "../page";

describe("F032 / AS-055: /dodaj/novi-proizvod offers a prefilled first-time entry form", () => {
  it("test_AS_055_the_scanned_gtin_from_the_query_string_prefills_the_barcode_field", async () => {
    const ui = await NoviProizvodPage({
      searchParams: Promise.resolve({ barkod: "5901234123457" }),
    });
    render(ui);

    expect(screen.getByTestId("novi-proizvod-page")).toBeInTheDocument();
    expect(screen.getByTestId("novi-proizvod-gtin")).toHaveTextContent(
      "5901234123457"
    );
    expect(screen.getByTestId("novi-proizvod-form")).toBeInTheDocument();
    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue(
      "5901234123457"
    );
  });

  it("test_a_missing_gtin_still_renders_a_real_usable_form_not_a_crash", async () => {
    const ui = await NoviProizvodPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByTestId("novi-proizvod-page")).toBeInTheDocument();
    expect(screen.queryByTestId("novi-proizvod-gtin")).not.toBeInTheDocument();
    expect(screen.getByTestId("novi-proizvod-form")).toBeInTheDocument();
    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue("");
  });

  it("test_a_search_param_array_barkod_still_prefills_from_the_first_value", async () => {
    const ui = await NoviProizvodPage({
      searchParams: Promise.resolve({
        barkod: ["5901234123457", "extra"],
      }),
    });
    render(ui);

    expect(screen.getByTestId("novi-proizvod-barcode-input")).toHaveValue(
      "5901234123457"
    );
  });
});
