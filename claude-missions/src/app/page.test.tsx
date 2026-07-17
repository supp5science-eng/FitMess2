import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("root page (F001 scaffold smoke test)", () => {
  it("test_AS_001_root_page_renders_without_throwing", () => {
    // AS-001: App builds and starts locally without errors. A component
    // that throws during render would fail this test the same way a
    // broken build/dev-server would fail to serve the page.
    expect(() => render(<Home />)).not.toThrow();
  });

  it("test_AS_002_root_page_serves_serbian_text", () => {
    // AS-002: Root URL serves a page with Serbian (sr-Latn) text.
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Adaptive Cut" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aplikacija za praćenje ishrane/i)
    ).toBeInTheDocument();
  });
});
