import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { InstallNudge } from "@/components/pwa/install-nudge";

// The app-shell wrapper around the recurring install nudge. Its only job is to
// answer "is now a rude time to ask" -- the overlay itself decides whether the
// user is due a pitch at all (see install-overlay.test.tsx).

const pathname = vi.hoisted(() => ({ value: "/danas" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Longer than the overlay's revisit delay, so one advance covers the rise-in. */
const PAST_DELAY_MS = 3000;

describe("InstallNudge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    stubMatchMedia();
    pathname.value = "/danas";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("test_install_nudge_asks_on_an_ordinary_app_screen", () => {
    render(<InstallNudge />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(["/dodaj/obrok", "/dodaj/gric", "/dodaj/najtacnije", "/dodaj"])(
    "test_install_nudge_never_interrupts_logging_on_%s",
    (route) => {
      // These flows open the camera, record audio, and run timed confirmation
      // steps (Gric auto-saves on a countdown). A full-screen modal landing
      // mid-capture costs the user a real meal entry -- far more expensive
      // than a missed install pitch.
      pathname.value = route;
      render(<InstallNudge />);
      act(() => {
        vi.advanceTimersByTime(PAST_DELAY_MS);
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  );

  it("test_install_nudge_leaves_no_shown_record_when_it_stayed_out_of_the_way", () => {
    // Suppression must not count as a showing: the user gets asked on the very
    // next screen they land on, not one visit later.
    pathname.value = "/dodaj/obrok";
    render(<InstallNudge />);
    act(() => {
      vi.advanceTimersByTime(PAST_DELAY_MS);
    });

    expect(window.localStorage.getItem("fm_install_shown_at")).toBeNull();
  });
});
