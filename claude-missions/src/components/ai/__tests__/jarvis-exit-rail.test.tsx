import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { JarvisExitRail } from "@/components/ai/jarvis-exit-rail";
import { PULL_EXIT_DISTANCE_PX } from "@/lib/ui/pull-to-exit";

// The only door off the Jarvis screen: the bottom navigation is hidden, and an
// installed PWA has no browser chrome and no back button. The two failure
// modes are opposite and both bad -- firing on a stray touch, and not firing
// on a real pull -- so both directions are pinned here.

const push = vi.hoisted(() => vi.fn());
const pulse = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/feel/haptic", () => ({ pulse }));

/**
 * jsdom ships no `PointerEvent`, so Testing Library's `fireEvent.pointerDown`
 * cannot carry `clientY`. A `MouseEvent` under the pointer event's name does:
 * React dispatches by event type, and `clientY` is a MouseEvent field.
 */
function pointer(type: string, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientY", { value: clientY });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

/** Grab the rail at `from` and drag it up by `dy` px without letting go. */
function pullUp(element: HTMLElement, dy: number, from = 400) {
  fireEvent(element, pointer("pointerdown", from));
  fireEvent(element, pointer("pointermove", from - dy));
}

function rail(): HTMLElement {
  return screen.getByTestId("jarvis-exit-rail");
}

function level(element: HTMLElement): string {
  return element.style.getPropertyValue("--jer-pull");
}

beforeEach(() => {
  push.mockClear();
  pulse.mockClear();
});

afterEach(cleanup);

describe("JarvisExitRail — leaving", () => {
  it("test_a_complete_pull_leaves_for_the_dashboard", () => {
    render(<JarvisExitRail />);
    const el = rail();

    pullUp(el, PULL_EXIT_DISTANCE_PX);
    expect(level(el)).toBe("1.000");

    fireEvent(el, pointer("pointerup", 400 - PULL_EXIT_DISTANCE_PX));

    expect(push).toHaveBeenCalledWith("/danas");
  });

  it("test_a_pull_that_stops_short_springs_back_and_stays", () => {
    render(<JarvisExitRail />);
    const el = rail();

    pullUp(el, PULL_EXIT_DISTANCE_PX - 8);
    expect(level(el)).not.toBe("1.000");

    fireEvent(el, pointer("pointerup", 400 - (PULL_EXIT_DISTANCE_PX - 8)));

    expect(push).not.toHaveBeenCalled();
    // Nothing half-red is left behind for the next visit to inherit.
    expect(level(el)).toBe("0.000");
  });

  it("test_dragging_downward_never_arms_the_exit", () => {
    render(<JarvisExitRail />);
    const el = rail();

    fireEvent(el, pointer("pointerdown", 400));
    fireEvent(el, pointer("pointermove", 470));
    fireEvent(el, pointer("pointerup", 470));

    expect(push).not.toHaveBeenCalled();
    expect(level(el)).toBe("0.000");
  });

  it("test_a_cancelled_pointer_leaves_nothing_armed", () => {
    // The system takes the pointer away (a call, a notification gesture).
    render(<JarvisExitRail />);
    const el = rail();

    pullUp(el, PULL_EXIT_DISTANCE_PX / 2);
    fireEvent(el, pointer("pointercancel", 400 - PULL_EXIT_DISTANCE_PX / 2));

    expect(push).not.toHaveBeenCalled();
    expect(level(el)).toBe("0.000");
  });

  it("test_a_completed_pull_does_not_navigate_twice", () => {
    // The click that trails a pull ending ON the rail would repeat a trip the
    // pointer handler already made.
    render(<JarvisExitRail />);
    const el = rail();

    pullUp(el, PULL_EXIT_DISTANCE_PX);
    fireEvent(el, pointer("pointerup", 400 - PULL_EXIT_DISTANCE_PX));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(el, click);

    expect(push).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
  });

  it("test_a_plain_tap_still_leaves_through_the_link", () => {
    // An earlier cut made the pull the ONLY way out, so leaving could never
    // happen by accident. Pressed by a human it read as broken -- and "does
    // nothing" is indistinguishable from "broken" on the only door there is.
    render(<JarvisExitRail />);
    const el = rail();

    fireEvent(el, pointer("pointerdown", 400));
    fireEvent(el, pointer("pointerup", 400));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(el, click);

    expect(click.defaultPrevented).toBe(false);
    expect(el).toHaveAttribute("href", "/danas");
  });

  it("test_the_rail_is_a_real_link_for_keyboard_and_broken_hydration", () => {
    // Keyboard and screen reader users have no drag available, and none of
    // these handlers exist before the screen hydrates. Both fall back to the
    // same plain href.
    render(<JarvisExitRail />);

    expect(rail()).toHaveAttribute("href", "/danas");
  });
});

describe("JarvisExitRail — what it says while you pull", () => {
  it("test_the_level_tracks_the_finger_the_whole_way_up", () => {
    // The level IS the threshold, so it has to be honest at every point -- a
    // rail that fills only at the end teaches nothing.
    render(<JarvisExitRail />);
    const el = rail();

    fireEvent(el, pointer("pointerdown", 400));
    fireEvent(el, pointer("pointermove", 400 - PULL_EXIT_DISTANCE_PX / 4));
    expect(level(el)).toBe("0.250");
    fireEvent(el, pointer("pointermove", 400 - PULL_EXIT_DISTANCE_PX / 2));
    expect(level(el)).toBe("0.500");
  });

  it("test_the_rail_stays_untransitioned_across_the_armed_re_render", () => {
    // Crossing the threshold re-renders -- `data-armed` changes. The drag flag
    // has to survive that render: it is what holds the spring-back transition
    // OFF while the finger is down, and a rail that starts easing toward its
    // last position mid-gesture visibly trails the thumb.
    render(<JarvisExitRail />);
    const el = rail();

    pullUp(el, PULL_EXIT_DISTANCE_PX);

    expect(el.dataset.dragging).toBe("true");
    expect(el.dataset.armed).toBe("true");
  });

  it("test_the_arming_buzz_fires_once_not_every_frame", () => {
    // The crossing is the event, not the state above it. A pulse per frame
    // past the line is a rumble, and a rumble carries no information.
    render(<JarvisExitRail />);
    const el = rail();

    fireEvent(el, pointer("pointerdown", 400));
    for (const dy of [
      PULL_EXIT_DISTANCE_PX,
      PULL_EXIT_DISTANCE_PX + 20,
      PULL_EXIT_DISTANCE_PX + 60,
    ]) {
      fireEvent(el, pointer("pointermove", 400 - dy));
    }

    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it("test_falling_back_under_the_line_lets_the_buzz_arm_again", () => {
    // Pulling back down un-arms, so the user gets the same confirmation when
    // they commit a second time.
    render(<JarvisExitRail />);
    const el = rail();

    fireEvent(el, pointer("pointerdown", 400));
    fireEvent(el, pointer("pointermove", 400 - PULL_EXIT_DISTANCE_PX));
    fireEvent(el, pointer("pointermove", 400 - PULL_EXIT_DISTANCE_PX / 2));
    fireEvent(el, pointer("pointermove", 400 - PULL_EXIT_DISTANCE_PX));

    expect(pulse).toHaveBeenCalledTimes(2);
  });

  it("test_a_pull_that_never_reaches_the_line_stays_silent", () => {
    render(<JarvisExitRail />);

    pullUp(rail(), PULL_EXIT_DISTANCE_PX - 4);

    expect(pulse).not.toHaveBeenCalled();
  });

  it("test_the_rail_says_what_it_wants_and_when_it_will_fire", () => {
    render(<JarvisExitRail />);

    expect(screen.getByText("Prevuci na gore da izađeš")).toBeInTheDocument();

    pullUp(rail(), PULL_EXIT_DISTANCE_PX);

    expect(screen.getByText("Pusti da izađeš")).toBeInTheDocument();
  });
});
