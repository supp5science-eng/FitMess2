import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// The landing page's <InstallButton> island probes `window.matchMedia` in a
// mount effect to detect an already-installed (standalone) PWA. jsdom has no
// matchMedia, so stub a benign "not standalone" response before rendering.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

describe("root landing page (F001 scaffold smoke test + FitMess landing)", () => {
  it("test_AS_001_root_page_renders_without_throwing", () => {
    // AS-001: App builds and starts locally without errors. A component that
    // threw during render would fail this test the same way a broken
    // build/dev-server would fail to serve the page.
    expect(() => render(<Home />)).not.toThrow();
  });

  it("test_AS_002_root_page_serves_serbian_text", () => {
    // AS-002: Root URL serves a page with Serbian (sr-Latn) text. The
    // marketing landing leads with its Serbian headline and install CTA.
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /puca kad ti pukne/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Instaliraj FitMess/i).length).toBeGreaterThan(0);
  });
});
