import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// The landing is a minimal, Cal-AI-style single screen: an animated scan
// phone, one Serbian headline, and a single primary CTA (+ sign-in link).
// There is no install CTA here anymore — onboarding runs on the web first.

describe("root landing page (F001 scaffold smoke test + FitMess landing)", () => {
  it("test_AS_001_root_page_renders_without_throwing", () => {
    // AS-001: App builds and starts locally without errors. A component that
    // threw during render would fail this test the same way a broken
    // build/dev-server would fail to serve the page.
    expect(() => render(<Home />)).not.toThrow();
  });

  it("test_AS_002_root_page_serves_serbian_text", () => {
    // AS-002: Root URL serves a page with Serbian (sr-Latn) text.
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Prati kalorije bez muke/i })
    ).toBeInTheDocument();
  });

  it("test_landing_leads_with_get_started_to_the_questionnaire", () => {
    render(<Home />);
    const start = screen.getByRole("link", { name: /Započni/i });
    expect(start).toHaveAttribute("href", "/upitnik");
  });

  it("test_landing_offers_sign_in_for_returning_users", () => {
    render(<Home />);
    const signIn = screen.getByRole("link", { name: /Prijavi se/i });
    expect(signIn).toHaveAttribute("href", "/prijava");
  });
});
