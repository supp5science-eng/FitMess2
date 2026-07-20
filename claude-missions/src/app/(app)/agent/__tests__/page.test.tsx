import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// The bottom nav's "Agent" tab points to `/agent`, which isn't built yet.
// This proves the route renders a real, clear Serbian "coming soon" page
// (never a blank/broken 404), and offers a real way back into the app --
// same posture as the `/dodaj/uskoro/[metoda]` placeholder.

import AgentUskoroPage from "../page";

describe("/agent renders a friendly Serbian 'uskoro' placeholder", () => {
  it("renders the coming-soon page with its title and badge", () => {
    render(<AgentUskoroPage />);

    expect(screen.getByTestId("agent-uskoro-page")).toBeInTheDocument();
    expect(screen.getByTestId("agent-uskoro-badge")).toHaveTextContent(
      "Uskoro"
    );
    expect(
      screen.getByRole("heading", { name: "FitMess Agent" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("agent-uskoro-body").textContent?.length).toBeGreaterThan(
      0
    );
  });

  it("offers a real link back to the home screen", () => {
    render(<AgentUskoroPage />);

    expect(screen.getByRole("link", { name: "Nazad na Danas" })).toHaveAttribute(
      "href",
      "/danas"
    );
  });

  it("offers a real link into the active add-food search flow", () => {
    render(<AgentUskoroPage />);

    expect(
      screen.getByRole("link", { name: "Dodaj obrok pretragom" })
    ).toHaveAttribute("href", "/dodaj/pretraga");
  });
});
