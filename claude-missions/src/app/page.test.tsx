import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// The landing is a minimal, Cal-AI-style single screen: an animated scan
// phone, one Serbian headline, and a single primary CTA (+ sign-in link).
// There is no install CTA here anymore — onboarding runs on the web first.

describe("root landing page (F001 scaffold smoke test + FitMess landing)", () => {
  it("test_AS_001_root_page_renders_without_throwing", async () => {
    // AS-001: App builds and starts locally without errors. A component that
    // threw during render would fail this test the same way a broken
    // build/dev-server would fail to serve the page.
    const ui = await Home();
    expect(() => render(ui)).not.toThrow();
  });

  it("test_AS_002_root_page_serves_serbian_text", async () => {
    // AS-002: Root URL serves a page with Serbian (sr-Latn) text.
    render(await Home());
    expect(
      screen.getByRole("heading", { name: /Prati kalorije bez muke/i })
    ).toBeInTheDocument();
  });

  it("test_landing_leads_with_get_started_to_the_questionnaire", async () => {
    render(await Home());
    const start = screen.getByRole("link", { name: /Započni/i });
    expect(start).toHaveAttribute("href", "/upitnik");
  });

  it("test_landing_offers_sign_in_for_returning_users", async () => {
    render(await Home());
    const signIn = screen.getByRole("link", { name: /Prijavi se/i });
    expect(signIn).toHaveAttribute("href", "/prijava");
  });

  // Prelaunch status: the product is a web app today and the store builds are
  // in progress. Both halves are load-bearing -- the badge answers "is this
  // real?" before the CTA, the section answers "where do I get it?" after the
  // features -- so both are asserted.

  it("test_landing_declares_the_prelaunch_web_status_above_the_headline", async () => {
    render(await Home());
    expect(screen.getByText(/Prelaunch · web verzija/i)).toBeInTheDocument();
  });

  it("test_landing_lists_the_web_app_as_available_and_both_stores_as_in_progress", async () => {
    render(await Home());

    const stores = screen.getByRole("region", {
      name: /Za sad web, uskoro i u prodavnicama/i,
    });
    expect(stores).toBeInTheDocument();

    // The one row that is a fact today reads differently from the two that are
    // plans -- if "U pripremi" ever leaked onto the web row, the page would be
    // telling visitors the thing they are looking at doesn't exist yet.
    expect(screen.getByText(/Web aplikacija/i)).toBeInTheDocument();
    expect(screen.getByText(/Dostupno sada/i)).toBeInTheDocument();
    expect(screen.getByText("App Store")).toBeInTheDocument();
    expect(screen.getByText("Google Play")).toBeInTheDocument();
    expect(screen.getAllByText(/U pripremi/i)).toHaveLength(2);
  });

  it("test_landing_promises_no_launch_date", async () => {
    // A date on a landing page is a promise the roadmap has to keep. The copy
    // deliberately makes none, and this test is what keeps a well-meaning edit
    // ("uskoro u martu!") from quietly introducing one.
    render(await Home());
    const stores = screen.getByRole("region", {
      name: /Za sad web, uskoro i u prodavnicama/i,
    });
    expect(stores.textContent ?? "").not.toMatch(
      /\b(20\d\d|januar|februar|mart|april|maj|jun|jul|avgust|septembar|oktobar|novembar|decembar|Q[1-4])\b/i
    );
  });

  // The hero is the motion-graphics film. Every attribute asserted below is
  // load-bearing rather than decorative: drop `muted` or `playsInline` and iOS
  // Safari refuses to autoplay at all, leaving the first screen a still image.
  it("test_landing_hero_plays_the_motion_graphics_film_muted_and_looping", async () => {
    const { container } = render(await Home());

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video?.muted).toBe(true);
    // Decorative — the headline and CTA carry the meaning.
    expect(video).toHaveAttribute("aria-hidden", "true");

    // A poster, so the hero is never an empty box while the film loads (and is
    // the whole hero for anyone who asked for reduced motion).
    expect(video).toHaveAttribute("poster", "/landing/hero-poster.jpg");

    // WebM first, MP4 second: Safari takes the MP4, everyone else the smaller
    // WebM. Losing the MP4 would leave iOS — the only platform this app is
    // served on — with no playable source.
    const sources = [...container.querySelectorAll("video source")].map((s) =>
      s.getAttribute("src")
    );
    expect(sources).toEqual(["/landing/hero.webm", "/landing/hero.mp4"]);
  });
});
