import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// F028 / AS-051: "From the home screen, starting any of the logging methods
// takes at most 2 taps." Tap 1 = the floating "+" button opens the sheet.
// Tap 2 = tapping any option (a real `next/link` anchor) navigates to that
// method's flow -- these tests prove both taps and the sheet's structure.

import { AddSheet } from "@/components/home/add-sheet";

describe("AS-051: the '+' button is closed by default and opens the sheet on tap 1", () => {
  it("test_AS_051_the_sheet_is_not_rendered_until_the_plus_button_is_tapped", () => {
    render(<AddSheet />);

    expect(screen.getByTestId("add-sheet-open-button")).toBeInTheDocument();
    expect(screen.queryByTestId("add-sheet")).not.toBeInTheDocument();
  });

  it("test_AS_051_tapping_the_plus_button_once_opens_the_sheet_tap_1_of_2", () => {
    render(<AddSheet />);

    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    expect(screen.getByTestId("add-sheet")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("AS-051: every logging method is a real, single-tap-reachable link once the sheet is open", () => {
  it("test_AS_051_all_four_logging_methods_are_listed_as_real_navigable_links", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    const expectedHrefs: Record<string, string> = {
      pretrazi: "/dodaj/pretraga",
      barkod: "/dodaj/skener",
      deklaracija: "/dodaj/deklaracija",
      obrok: "/dodaj/obrok",
    };

    for (const [key, href] of Object.entries(expectedHrefs)) {
      const link = screen.getByTestId(`add-sheet-option-${key}`);
      // A real anchor (next/link renders an <a>), keyboard-reachable and
      // requiring exactly one activation (tap 2) to navigate -- not a
      // `<div onClick>` fake link.
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("test_AS_051_all_methods_are_built_so_none_show_an_uskoro_badge", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    // Search (F024), barcode (F030), meal photos (F064) and label photos
    // (F063) are all built now -- no method is stubbed, so none carries the
    // "Uskoro" badge.
    for (const key of ["pretrazi", "barkod", "obrok", "deklaracija"]) {
      expect(
        screen.queryByTestId(`add-sheet-soon-badge-${key}`)
      ).not.toBeInTheDocument();
    }
  });

  it("test_AS_051_the_photo_links_point_to_the_real_meal_and_label_flows", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    expect(screen.getByTestId("add-sheet-option-obrok")).toHaveAttribute(
      "href",
      "/dodaj/obrok"
    );
    expect(screen.getByTestId("add-sheet-option-deklaracija")).toHaveAttribute(
      "href",
      "/dodaj/deklaracija"
    );
  });

  it("test_AS_051_the_pretrazi_link_points_to_the_real_active_search_screen", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    expect(screen.getByTestId("add-sheet-option-pretrazi")).toHaveAttribute(
      "href",
      "/dodaj/pretraga"
    );
  });

  it("test_AS_051_the_barkod_link_points_to_the_real_scanner_screen", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    expect(screen.getByTestId("add-sheet-option-barkod")).toHaveAttribute(
      "href",
      "/dodaj/skener"
    );
  });

  it("test_the_dodaj_proizvod_option_links_to_the_add_product_flow_with_its_note", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    const option = screen.getByTestId("add-sheet-option-proizvod");
    expect(option.tagName).toBe("A");
    expect(option).toHaveAttribute("href", "/dodaj/proizvod");
    // The "only products with a declaration + barcode" note is shown inline.
    expect(screen.getByTestId("add-sheet-desc-proizvod")).toHaveTextContent(
      "Samo proizvodi sa deklaracijom i barkodom"
    );
  });

});

describe("AS-051: closing the sheet", () => {
  it("test_the_close_button_closes_the_sheet", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));
    fireEvent.click(screen.getByTestId("add-sheet-close-button"));

    expect(screen.queryByTestId("add-sheet")).not.toBeInTheDocument();
  });

  it("test_clicking_the_backdrop_closes_the_sheet", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));
    fireEvent.click(screen.getByTestId("add-sheet-overlay"));

    expect(screen.queryByTestId("add-sheet")).not.toBeInTheDocument();
  });
});

describe("AS-128: the '+' trigger and sheet controls are labeled and keyboard-reachable", () => {
  it("test_AS_128_the_plus_button_has_an_accessible_name", () => {
    render(<AddSheet />);
    expect(screen.getByLabelText("Dodaj unos")).toBe(
      screen.getByTestId("add-sheet-open-button")
    );
  });

  it("test_AS_128_the_close_button_has_an_accessible_name", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));
    expect(screen.getByLabelText("Zatvori")).toBe(
      screen.getByTestId("add-sheet-close-button")
    );
  });

  it("test_AS_128_the_sheet_renders_no_bare_images_without_alt_text", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));
    const images = screen.getByTestId("add-sheet").querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
