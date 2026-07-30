import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { DateStrip } from "@/components/home/date-strip";
import { buildDateStrip } from "@/lib/home/date-strip";

// The date strip is how you "go back to a past day" on /danas. It is now a
// horizontal WHEEL under a fixed centre marker (2026-07-30 redesign): each real
// day is a button, and wherever the scroll SETTLES the dashboard navigates to
// that day (`router.push` to `/danas?dan=YYYY-MM-DD`, today -> bare `/danas`).
// Future and pre-sign-up days are faint, NON-interactive filler; a settle that
// lands on one snaps back to the nearest real day instead of navigating nowhere.
// These tests lock that wiring so the past-day navigation the dashboard depends
// on can't silently regress.

const push = vi.fn();
const prefetch = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch }),
  useSearchParams: () => searchParams,
}));

// Fixed "now": 2026-07-19. Sign-up on 2026-07-17, so 07-15/07-16 are
// pre-sign-up filler; 07-20/07-21 are the future. Cells are indices 0..6.
const TODAY = "2026-07-19";

function buildDays() {
  return buildDateStrip({
    now: new Date("2026-07-19T12:00:00.000Z"),
    selectedKey: TODAY,
    loggedDays: new Set(["2026-07-18"]),
    startKey: "2026-07-15",
    endKey: "2026-07-21",
    minKey: "2026-07-17",
  });
}

// jsdom has no layout: give the first cell a real width and a spy-able scrollTo
// so the wheel's index maths (round(scrollLeft / cellWidth)) can run.
const CELL_W = 64;

function mount() {
  render(<DateStrip days={buildDays()} todayKey={TODAY} />);
  const scroller = screen.getByTestId("date-strip");
  const first = scroller.firstElementChild as HTMLElement;
  first.getBoundingClientRect = () =>
    ({
      width: CELL_W,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  return { scroller, scrollTo };
}

beforeEach(() => {
  push.mockClear();
  prefetch.mockClear();
  searchParams = new URLSearchParams();
});

describe("DateStrip: which days are reachable", () => {
  it("test_a_past_logged_day_is_a_button", () => {
    mount();
    expect(
      screen.getByRole("button", { name: "18. jul — uneo si obrok" })
    ).toBeInTheDocument();
  });

  it("test_the_signup_day_is_a_reachable_past_day", () => {
    mount();
    expect(screen.getByRole("button", { name: "17. jul" })).toBeInTheDocument();
  });

  it("test_today_is_a_reachable_day", () => {
    mount();
    expect(
      screen.getByRole("button", { name: "Danas, 19. jul" })
    ).toBeInTheDocument();
  });

  it("test_only_past_and_today_days_are_interactive_future_and_presignup_are_not", () => {
    mount();
    // Tappable: 07-17 (sign-up), 07-18 (past), 07-19 (today) = 3 buttons.
    // NOT tappable: 07-15 / 07-16 (pre-sign-up) and 07-20 / 07-21 (future).
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});

describe("DateStrip: settling on a day navigates there", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("test_settling_on_a_past_day_pushes_that_days_view", () => {
    const { scroller } = mount();
    // Let the mount placement (which centres today) run first, then scroll away.
    vi.advanceTimersByTime(50);

    // Rest centred on 07-18 (index 3) and let scrolling go idle. The pointer
    // down models the real gesture that precedes any settle -- the wheel only
    // navigates in response to a genuine user touch, never on its own.
    fireEvent.pointerDown(scroller);
    scroller.scrollLeft = 3 * CELL_W;
    fireEvent.scroll(scroller);
    vi.advanceTimersByTime(200);

    expect(push).toHaveBeenCalledWith("/danas?dan=2026-07-18");
  });

  it("test_settling_on_the_today_column_pushes_bare_danas", () => {
    // Start on a past day so a settle onto today is a real change.
    searchParams = new URLSearchParams("dan=2026-07-18");
    const { scroller } = mount();
    vi.advanceTimersByTime(50);

    fireEvent.pointerDown(scroller);
    scroller.scrollLeft = 4 * CELL_W; // index 4 = today (07-19)
    fireEvent.scroll(scroller);
    vi.advanceTimersByTime(200);

    expect(push).toHaveBeenCalledWith("/danas");
  });

  it("test_settling_on_a_future_day_snaps_back_and_does_not_navigate_to_it", () => {
    const { scroller } = mount();
    vi.advanceTimersByTime(50);

    fireEvent.pointerDown(scroller);
    scroller.scrollLeft = 5 * CELL_W; // index 5 = 07-20 (future filler)
    fireEvent.scroll(scroller);
    vi.advanceTimersByTime(200);

    // Never navigates to a day that doesn't exist yet.
    expect(push).not.toHaveBeenCalledWith("/danas?dan=2026-07-20");
  });

  it("test_does_not_navigate_without_a_user_gesture_on_load", () => {
    // The strip programmatically scrolls itself onto a day on mount. Even if
    // that placement rests off-centre, it must NEVER push a navigation without
    // a real user gesture -- this is the guard against booting onto the wrong
    // day. Simulate a settle with no preceding pointer/touch interaction.
    const { scroller } = mount();
    vi.advanceTimersByTime(50);

    scroller.scrollLeft = 3 * CELL_W; // would be 07-18 if it navigated
    fireEvent.scroll(scroller);
    vi.advanceTimersByTime(200);

    expect(push).not.toHaveBeenCalled();
  });
});

describe("DateStrip: the wheel always ends up visible", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** jsdom has no layout: give the current first cell a measurable width. */
  function measure(scroller: HTMLElement) {
    const first = scroller.firstElementChild as HTMLElement;
    first.getBoundingClientRect = () =>
      ({
        width: CELL_W,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    scroller.scrollTo = vi.fn() as unknown as typeof scroller.scrollTo;
  }

  it("test_the_wheel_is_revealed_even_when_the_days_prop_identity_changes_before_placement", () => {
    // The strip is held at `opacity-0` until it has centred itself on the
    // selected day. On /danas the header ALSO streams in a Suspense slot (the
    // streak pill); when that resolves, the layout re-renders and hands the
    // strip a FRESH `days` array -- same content, new identity -- which can
    // land before the placement frame has run. If that cancels the placement
    // without ever revealing the wheel, the user gets a date strip that is
    // permanently invisible: the centre marker shows, but not a single day.
    const view = render(<DateStrip days={buildDays()} todayKey={TODAY} />);
    const scroller = screen.getByTestId("date-strip");
    measure(scroller);

    view.rerender(<DateStrip days={buildDays()} todayKey={TODAY} />);
    measure(screen.getByTestId("date-strip"));

    // `act` so React flushes the reveal that placement schedules from its
    // animation frame (timer callbacks are not auto-wrapped like events are).
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("date-strip").className).not.toContain(
      "opacity-0"
    );
  });
});
