import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanup, renderHook } from "@testing-library/react";

import {
  KEYBOARD_BOTTOM_OFFSET,
  KEYBOARD_INSET_VAR,
  measureKeyboardInset,
  useKeyboardInset,
} from "@/lib/ui/use-keyboard-inset";

// The composer-above-the-keyboard hook. Two things are being protected here
// and neither is visible from a screenshot: that a platform without
// `visualViewport` degrades to today's behaviour instead of throwing, and that
// the keyboard's slide-in does not turn into a React render per frame.

/** A phone-sized layout viewport; the keyboard is measured against this. */
const LAYOUT_HEIGHT = 844;
/** A plausible iPhone keyboard, home indicator included. */
const KEYBOARD_HEIGHT = 336;

/**
 * Stand-in for `window.visualViewport`. jsdom has no visual viewport at all,
 * which is itself one of the cases under test, so both the presence and the
 * absence of the API are set up by hand.
 */
class StubVisualViewport extends EventTarget {
  height = LAYOUT_HEIGHT;
  offsetTop = 0;

  /** Move the visual viewport the way a keyboard opening would, and notify. */
  cover(px: number) {
    this.height = LAYOUT_HEIGHT - px;
    this.dispatchEvent(new Event("resize"));
  }
}

let viewport: StubVisualViewport;

/**
 * A hand-driven animation-frame queue.
 *
 * The hook coalesces the event burst with `requestAnimationFrame`, so "how
 * many renders per frame" is only answerable if the test decides when a frame
 * happens. Fake timers alone would leave that to the timer backend.
 */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let realRaf: typeof window.requestAnimationFrame;
let realCancelRaf: typeof window.cancelAnimationFrame;

/** Run every frame callback queued since the last flush, inside `act`. */
function flushFrame() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of pending) callback(0);
  });
}

/** One frame, plus enough idle time for the settle timer to publish. */
function flushFrameAndSettle() {
  flushFrame();
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

function setVisualViewport(value: StubVisualViewport | undefined) {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value,
  });
}

function insetVar(): string {
  return document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR);
}

beforeEach(() => {
  vi.useFakeTimers();

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: LAYOUT_HEIGHT,
  });

  viewport = new StubVisualViewport();
  setVisualViewport(viewport);

  frames.clear();
  nextFrameId = 1;
  realRaf = window.requestAnimationFrame;
  realCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    frames.delete(id);
  }) as typeof window.cancelAnimationFrame;
});

afterEach(() => {
  cleanup();
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancelRaf;
  document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
  vi.useRealTimers();
});

describe("measureKeyboardInset", () => {
  it("test_measure_reports_the_gap_between_the_two_viewports", () => {
    expect(
      measureKeyboardInset(
        { height: LAYOUT_HEIGHT - KEYBOARD_HEIGHT, offsetTop: 0 },
        LAYOUT_HEIGHT
      )
    ).toBe(KEYBOARD_HEIGHT);
  });

  it("test_measure_counts_a_visual_viewport_pushed_down_by_ios", () => {
    // iOS chases the focused field into view by scrolling the visual viewport
    // instead of shrinking it further. `offsetTop` is then part of the gap --
    // ignoring it under-reports the keyboard by exactly that much and the
    // composer sits behind the top row of keys.
    expect(
      measureKeyboardInset(
        { height: LAYOUT_HEIGHT - KEYBOARD_HEIGHT - 60, offsetTop: 60 },
        LAYOUT_HEIGHT
      )
    ).toBe(KEYBOARD_HEIGHT);
  });

  it("test_measure_returns_zero_without_a_visual_viewport", () => {
    expect(measureKeyboardInset(null, LAYOUT_HEIGHT)).toBe(0);
    expect(measureKeyboardInset(undefined, LAYOUT_HEIGHT)).toBe(0);
  });

  it("test_measure_ignores_a_gap_too_small_to_be_a_keyboard", () => {
    // A collapsing browser URL bar, not a keyboard. Reacting to it would lift
    // the composer off the bottom edge while the user is only scrolling.
    expect(
      measureKeyboardInset({ height: LAYOUT_HEIGHT - 30, offsetTop: 0 }, LAYOUT_HEIGHT)
    ).toBe(0);
  });

  it("test_measure_clamps_the_negative_gap_from_rubber_band_scrolling", () => {
    expect(
      measureKeyboardInset({ height: LAYOUT_HEIGHT + 50, offsetTop: 0 }, LAYOUT_HEIGHT)
    ).toBe(0);
  });

  it("test_measure_survives_a_viewport_reporting_nonsense", () => {
    expect(measureKeyboardInset({ height: Number.NaN, offsetTop: 0 }, LAYOUT_HEIGHT)).toBe(0);
  });
});

describe("useKeyboardInset", () => {
  it("test_hook_starts_closed_and_hands_back_the_combined_offset", () => {
    const { result } = renderHook(() => useKeyboardInset());

    expect(result.current.height).toBe(0);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.bottomOffset).toBe(KEYBOARD_BOTTOM_OFFSET);
  });

  it("test_bottom_offset_combines_the_safe_area_without_doubling_it", () => {
    // `max()`, never `+`: with the keyboard up it is drawn over the home
    // indicator, so the measured height already spans the safe area. Summing
    // them would leave a ~34px dead band above the keys.
    expect(KEYBOARD_BOTTOM_OFFSET).toBe(
      `max(env(safe-area-inset-bottom, 0px), var(${KEYBOARD_INSET_VAR}, 0px))`
    );
    expect(KEYBOARD_BOTTOM_OFFSET).not.toContain("+");
  });

  it("test_hook_reports_the_keyboard_once_it_settles", () => {
    const { result } = renderHook(() => useKeyboardInset());

    act(() => {
      viewport.cover(KEYBOARD_HEIGHT);
    });
    flushFrameAndSettle();

    expect(result.current.isOpen).toBe(true);
    expect(result.current.height).toBe(KEYBOARD_HEIGHT);
  });

  it("test_hook_returns_to_closed_when_the_keyboard_hides", () => {
    const { result } = renderHook(() => useKeyboardInset());

    act(() => {
      viewport.cover(KEYBOARD_HEIGHT);
    });
    flushFrameAndSettle();

    act(() => {
      viewport.cover(0);
    });
    flushFrameAndSettle();

    expect(result.current.isOpen).toBe(false);
    expect(result.current.height).toBe(0);
    expect(insetVar()).toBe("0px");
  });

  it("test_hook_reads_a_keyboard_that_is_already_up_when_it_mounts", () => {
    // Navigating to the composer with the field already focused: no event
    // will ever fire, so a hook that only listens would report 0 forever.
    viewport.height = LAYOUT_HEIGHT - KEYBOARD_HEIGHT;

    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.height).toBe(KEYBOARD_HEIGHT);
  });

  it("test_hook_follows_the_slide_in_the_css_variable_without_re_rendering", () => {
    // The point of the whole design: 60 frames of keyboard animation move the
    // custom property 60 times and React at most twice -- once when the
    // keyboard crosses closed->open, once when the height settles.
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useKeyboardInset();
    });

    const rendersBefore = renders;

    for (let frame = 1; frame <= 60; frame += 1) {
      const covered = Math.round((KEYBOARD_HEIGHT * frame) / 60);
      act(() => {
        viewport.cover(covered);
      });
      flushFrame();
      // Each frame's live value reached the DOM -- except the opening sliver,
      // which is still under the "too small to be a keyboard" floor.
      expect(insetVar()).toBe(`${covered >= 44 ? covered : 0}px`);
    }

    expect(renders - rendersBefore).toBeLessThanOrEqual(2);
  });

  it("test_hook_coalesces_a_burst_of_events_into_one_measurement", () => {
    // The keyboard fires `resize` and `scroll` together and several of each
    // can land inside a single frame.
    renderHook(() => useKeyboardInset());
    frames.clear();

    act(() => {
      for (let i = 0; i < 20; i += 1) {
        viewport.dispatchEvent(new Event("resize"));
        viewport.dispatchEvent(new Event("scroll"));
      }
    });

    expect(frames.size).toBe(1);
  });

  it("test_hook_reports_zero_when_the_platform_has_no_visual_viewport", () => {
    // Old WebViews and server rendering. Nothing throws, nothing is written,
    // and every consumer falls back to the safe area alone.
    setVisualViewport(undefined);

    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.height).toBe(0);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.bottomOffset).toBe(KEYBOARD_BOTTOM_OFFSET);
    expect(insetVar()).toBe("");
  });

  it("test_hook_reports_zero_when_the_shell_resizes_the_web_view_itself", () => {
    // Capacitor with a resizing web view (and Android's `adjustResize`): the
    // layout viewport shrinks with the visual one, so there is no gap and no
    // inset to add -- the platform has already made the layout correct.
    const { result } = renderHook(() => useKeyboardInset());

    act(() => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: LAYOUT_HEIGHT - KEYBOARD_HEIGHT,
      });
      viewport.cover(KEYBOARD_HEIGHT);
    });
    flushFrameAndSettle();

    expect(result.current.isOpen).toBe(false);
    expect(result.current.height).toBe(0);
  });

  it("test_hook_drops_its_listeners_and_variable_on_unmount", () => {
    const add = vi.spyOn(viewport, "addEventListener");
    const remove = vi.spyOn(viewport, "removeEventListener");

    const { unmount } = renderHook(() => useKeyboardInset());
    act(() => {
      viewport.cover(KEYBOARD_HEIGHT);
    });
    flushFrameAndSettle();
    expect(insetVar()).toBe(`${KEYBOARD_HEIGHT}px`);

    unmount();

    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      add.mock.calls.map(([type]) => type)
    );
    expect(insetVar()).toBe("");
  });

  it("test_hook_keeps_the_variable_alive_while_another_consumer_holds_it", () => {
    // A screen can mount the hook in both the shell and the composer. The
    // first to unmount must not blank the property out from under the other.
    const first = renderHook(() => useKeyboardInset());
    const second = renderHook(() => useKeyboardInset());

    act(() => {
      viewport.cover(KEYBOARD_HEIGHT);
    });
    flushFrameAndSettle();

    first.unmount();
    expect(insetVar()).toBe(`${KEYBOARD_HEIGHT}px`);

    second.unmount();
    expect(insetVar()).toBe("");
  });
});
