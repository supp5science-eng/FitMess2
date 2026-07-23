import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { InstallOverlay } from "@/components/pwa/install-overlay";

// The post-onboarding install overlay: platform-aware walkthrough, one-shot
// gating (localStorage + consumed cookie), quiet dismissal. jsdom has no
// matchMedia, so we stub it per-test (standalone vs browser-tab).

function stubMatchMedia({ standalone = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("display-mode: standalone") ? standalone : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function stubUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";

describe("InstallOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    stubMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("test_install_overlay_rises_with_platform_walkthrough_after_intro_beat", () => {
    stubUserAgent(IOS_UA);
    render(<InstallOverlay />);

    // Hidden during the post-intro beat...
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // ...then rises with the iOS (Safari) walkthrough.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(
      screen.getByRole("dialog", { name: /Dodaj FitMess na početni ekran/ })
    ).toBeInTheDocument();
    // Appears twice by design: in the step list AND inside the mini phone's
    // share sheet that demonstrates it.
    expect(screen.getAllByText(/Dodaj na početni ekran/).length).toBeGreaterThan(1);
    expect(screen.getByText(/u dnu Safari-ja/)).toBeInTheDocument();
  });

  it("test_install_overlay_dismisses_via_quiet_continue_in_browser", () => {
    stubUserAgent(IOS_UA);
    render(<InstallOverlay />);
    act(() => {
      vi.advanceTimersByTime(800);
    });

    screen.getByRole("button", { name: /Nastavi u pregledaču/ }).click();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_install_overlay_never_replays_once_seen", () => {
    stubUserAgent(IOS_UA);
    window.localStorage.setItem("fm_install_seen", "1");
    render(<InstallOverlay />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_install_overlay_skips_when_already_running_standalone", () => {
    stubUserAgent(IOS_UA);
    stubMatchMedia({ standalone: true });
    render(<InstallOverlay />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
