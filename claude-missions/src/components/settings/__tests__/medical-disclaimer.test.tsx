import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MedicalDisclaimer } from "../medical-disclaimer";

// The standing "not medical advice" note that closes Settings. It is the only
// place in the daily app surface where this is said, so the wording and the
// route out to the full terms are worth locking down.
describe("MedicalDisclaimer", () => {
  it("states plainly that FitMess is not medical advice", async () => {
    render(await MedicalDisclaimer());

    expect(screen.getByText(/nije medicinski savet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ne zamenjujemo lekara ni nutricionistu/i)
    ).toBeInTheDocument();
  });

  it("links to the full terms of use", async () => {
    render(await MedicalDisclaimer());

    const link = screen.getByRole("link", { name: /uslove korišćenja/i });
    expect(link).toHaveAttribute("href", "/profil/uslovi");
  });
});
