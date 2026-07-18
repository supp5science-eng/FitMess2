import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// F033 / AS-059: the Serbian "access denied" page `requireAdmin()` sends a
// non-admin visitor to. Proves it's a real, friendly page (never a blank
// screen) with a real way back into the app.

import NemasPristupPage from "../page";

describe("AS-059: /nemas-pristup renders a real Serbian denial page with a way back", () => {
  it("test_AS_059_nemas_pristup_renders_the_denial_heading_and_body", () => {
    render(<NemasPristupPage />);

    expect(screen.getByTestId("nemas-pristup-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nemaš pristup" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("nemas-pristup-body")).toHaveTextContent(
      "Nemaš dozvolu da vidiš ovu stranicu."
    );
  });

  it("test_AS_059_nemas_pristup_offers_a_real_link_back_into_the_app", () => {
    render(<NemasPristupPage />);

    expect(screen.getByRole("link", { name: "Nazad na Danas" })).toHaveAttribute(
      "href",
      "/danas"
    );
  });
});
