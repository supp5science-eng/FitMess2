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

// The recurring nudge: people who keep using FitMess in a browser tab get the
// same walkthrough again on each new visit, because one pitch at onboarding
// converts a fraction and everyone else keeps paying the "find the tab" tax.
// A "visit" is defined by the gap since the last showing, so the same sitting
// (reload, tab switch, a trip through the "+" flows) never re-triggers it.

const VISIT_GAP_MS = 30 * 60 * 1000;
/** Longer than the revisit delay, so one advance covers the rise-in. */
const PAST_DELAY_MS = 3000;

describe("InstallOverlay in revisit mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    stubMatchMedia();
    stubUserAgent(IOS_UA);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("test_revisit_nudge_shows_for_a_browser_tab_user_with_no_history", () => {
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(
      screen.getByRole("dialog", { name: /Dodaj FitMess na početni ekran/ })
    ).toBeInTheDocument();
  });

  it("test_revisit_nudge_stays_quiet_for_the_rest_of_the_same_visit", () => {
    // Shown a minute ago -- same sitting, so asking again would be nagging.
    window.localStorage.setItem("fm_install_shown_at", String(Date.now() - 60_000));
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_revisit_nudge_returns_on_the_next_visit", () => {
    // Last seen longer ago than the gap: they left and came back.
    window.localStorage.setItem(
      "fm_install_shown_at",
      String(Date.now() - VISIT_GAP_MS - 1000)
    );
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });

  it("test_revisit_nudge_retires_for_good_once_the_app_was_installed", () => {
    // An `appinstalled` event was recorded earlier. The browser gives us no way
    // to ASK whether a site is installed, so this record is the only thing that
    // stops us pitching an app the user already has on their home screen.
    window.localStorage.setItem("fm_installed", "1");
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_revisit_nudge_is_silent_inside_the_installed_app", () => {
    stubMatchMedia({ standalone: true });
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_revisit_nudge_survives_a_remount_before_it_had_a_chance_to_rise", () => {
    // Regression: the gate used to record "asked" the moment it DECIDED to
    // show, before the rise-in delay elapsed. Any teardown in between -- React's
    // development double-mount, or the user tapping into a logging flow within
    // the first couple of seconds -- left the record behind with nothing shown,
    // and the re-mounted gate then read its own record and stayed quiet
    // forever. The prompt silently never appeared.
    const first = render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(500); // torn down mid-delay
    });
    first.unmount();

    expect(window.localStorage.getItem("fm_install_shown_at")).toBeNull();

    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("test_revisit_nudge_does_not_burn_the_one_shot_onboarding_moment", () => {
    // A revisit showing must not set the onboarding gate's own "seen" flag --
    // otherwise a browsing user would silently lose the post-onboarding pitch.
    render(<InstallOverlay mode="revisit" />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(window.localStorage.getItem("fm_install_seen")).toBeNull();
    expect(window.localStorage.getItem("fm_install_shown_at")).not.toBeNull();
  });
});
