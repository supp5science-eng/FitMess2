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
  it("test_AS_051_all_logging_methods_are_listed_as_real_navigable_links", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    const expectedHrefs: Record<string, string> = {
      // "Pretraži" and "Dodaj proizvod" were removed from this menu (the app is
      // photo/voice-first); their routes still exist but are no longer offered.
      obrok: "/dodaj/obrok",
      glas: "/dodaj/glas",
      deklaracija: "/dodaj/deklaracija",
      // Barcode is de-prioritised -- routed to the "uskoro" placeholder, not
      // the live scanner (which still exists at /dodaj/skener).
      barkod: "/dodaj/uskoro/barkod",
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

  it("test_the_active_methods_show_no_uskoro_badge_but_barcode_does", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    // Meal photo, voice and label photo are all live (no "Uskoro" badge).
    for (const key of ["obrok", "glas", "deklaracija"]) {
      expect(
        screen.queryByTestId(`add-sheet-soon-badge-${key}`)
      ).not.toBeInTheDocument();
    }

    // Barcode is intentionally deferred and carries the "Uskoro" badge.
    expect(
      screen.getByTestId("add-sheet-soon-badge-barkod")
    ).toBeInTheDocument();
  });

  it("test_the_voice_option_links_to_the_reci_obrok_flow_with_its_note", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    const option = screen.getByTestId("add-sheet-option-glas");
    expect(option.tagName).toBe("A");
    expect(option).toHaveAttribute("href", "/dodaj/glas");
    expect(screen.getByTestId("add-sheet-desc-glas")).toHaveTextContent(
      "Izgovori vrednosti ili samo opiši obrok"
    );
  });

  it("test_barcode_is_the_last_option_in_the_sheet", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    const options = screen
      .getByTestId("add-sheet")
      .querySelectorAll('[data-testid^="add-sheet-option-"]');
    const lastOption = options[options.length - 1];
    expect(lastOption).toHaveAttribute("data-testid", "add-sheet-option-barkod");
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

  it("test_pretrazi_and_proizvod_are_no_longer_offered_in_the_add_menu", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    // Removed on purpose (photo/voice-first). The routes still exist as hidden
    // fallbacks, but the "+" menu no longer advertises them.
    expect(
      screen.queryByTestId("add-sheet-option-pretrazi")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("add-sheet-option-proizvod")
    ).not.toBeInTheDocument();
  });

  it("test_the_barkod_link_points_to_the_uskoro_placeholder_while_deferred", () => {
    render(<AddSheet />);
    fireEvent.click(screen.getByTestId("add-sheet-open-button"));

    expect(screen.getByTestId("add-sheet-option-barkod")).toHaveAttribute(
      "href",
      "/dodaj/uskoro/barkod"
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
