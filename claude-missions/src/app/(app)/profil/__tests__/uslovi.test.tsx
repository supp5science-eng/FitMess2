import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import UsloviPage from "../uslovi/page";

// `/profil/uslovi` carries the medical disclaimer in full. These assertions
// guard the parts a user of a calorie tracker actually needs to read -- that
// the app is not a medical device, and the list of conditions where a doctor
// must be consulted before following the plan.
describe("Uslovi korišćenja", () => {
  it("leads with the not-medical-advice section", async () => {
    render(await UsloviPage());

    expect(
      screen.getByRole("heading", { name: /nije medicinski savet/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/nije medicinsko sredstvo/i)).toBeInTheDocument();
  });

  it("names the conditions that require a doctor first", async () => {
    render(await UsloviPage());

    expect(screen.getByText(/trudna si ili dojiš/i)).toBeInTheDocument();
    expect(screen.getByText(/dijabetes/i)).toBeInTheDocument();
    expect(screen.getByText(/poremećaj ishrane/i)).toBeInTheDocument();
    expect(screen.getByText(/mlađi\/a si od 18/i)).toBeInTheDocument();
  });

  it("says AI estimates are estimates, not measurements", async () => {
    render(await UsloviPage());

    expect(
      screen.getByText(/procena, ne merenje, i ume da promaši/i)
    ).toBeInTheDocument();
  });
});
