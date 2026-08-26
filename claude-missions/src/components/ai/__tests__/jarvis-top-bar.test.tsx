import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { JarvisTopBar } from "@/components/ai/jarvis-top-bar";
import { PULL_EXIT_DISTANCE_PX } from "@/lib/ui/pull-to-exit";

// The chrome above the Jarvis screen. The mode pill is ordinary tablist
// behaviour; the EXIT is not, and it is what these tests are mostly about.
// With the bottom navigation hidden and no browser chrome in an installed PWA,
// that one control is the only way off the screen -- so "a tap must not leave"
// and "a real pull must leave" are both load-bearing, in opposite directions.

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

/** Drag from `y` upward by `dy` px without letting go. */
function pullUp(element: HTMLElement, dy: number, from = 200) {
  fireEvent(element, pointer("pointerdown", from));
  fireEvent(element, pointer("pointermove", from - dy));
}

function exitButton(): HTMLElement {
  return screen.getByTestId("jarvis-exit");
}

function pull(element: HTMLElement): string {
  return element.style.getPropertyValue("--jtb-pull");
}

beforeEach(() => {
  push.mockClear();
  pulse.mockClear();
});

afterEach(cleanup);

describe("JarvisTopBar — mode pill", () => {
  it("test_top_bar_reports_the_mode_the_user_picked", () => {
    const onModeChange = vi.fn();
    render(<JarvisTopBar mode="voice" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByTestId("jarvis-mode-chat"));

    expect(onModeChange).toHaveBeenCalledWith("chat");
  });

  it("test_top_bar_marks_the_active_segment_for_assistive_tech", () => {
    render(<JarvisTopBar mode="chat" onModeChange={vi.fn()} />);

    expect(screen.getByTestId("jarvis-mode-chat")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("jarvis-mode-voice")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});

describe("JarvisTopBar — pull to exit", () => {
  it("test_a_plain_tap_leaves_through_the_link", () => {
    // An earlier cut made the pull the only way out, so leaving could never
    // happen by accident. Pressed by a human it read as a dead button -- and
    // "does nothing" is indistinguishable from "broken" on the only door this
    // screen has. The link works; the pull is an accelerator, not a gate.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    fireEvent(exit, pointer("pointerdown", 200));
    fireEvent(exit, pointer("pointerup", 200));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(exit, click);

    expect(click.defaultPrevented).toBe(false);
    expect(exit).toHaveAttribute("href", "/danas");
  });

  it("test_a_complete_pull_leaves_for_the_dashboard", () => {
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX);
    expect(pull(exit)).toBe("1.000");

    fireEvent(exit, pointer("pointerup", 200 - PULL_EXIT_DISTANCE_PX));

    expect(push).toHaveBeenCalledWith("/danas");
  });

  it("test_a_pull_that_stops_short_springs_back_and_stays", () => {
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX - 8);
    expect(pull(exit)).not.toBe("1.000");

    fireEvent(exit, pointer("pointerup", 200 - (PULL_EXIT_DISTANCE_PX - 8)));

    expect(push).not.toHaveBeenCalled();
    // Nothing half-red is left behind for the next visit to inherit.
    expect(pull(exit)).toBe("0.000");
  });

  it("test_the_button_stays_untransitioned_across_the_armed_re_render", () => {
    // Crossing the threshold re-renders -- the icon changes. The drag flag has
    // to survive that render: it is what holds the spring-back transition OFF
    // while the finger is down, and a button that starts easing toward its
    // last position mid-gesture visibly trails the thumb.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX);

    expect(exit.dataset.dragging).toBe("true");
  });

  it("test_the_fill_tracks_the_finger_the_whole_way_up", () => {
    // The colour IS the threshold, so it has to be honest at every point --
    // a button that jumps to red only at the end teaches nothing.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    fireEvent(exit, pointer("pointerdown", 200));
    fireEvent(exit, pointer("pointermove", 200 - PULL_EXIT_DISTANCE_PX / 4));
    expect(pull(exit)).toBe("0.250");
    fireEvent(exit, pointer("pointermove", 200 - PULL_EXIT_DISTANCE_PX / 2));
    expect(pull(exit)).toBe("0.500");
  });

  it("test_dragging_downward_never_arms_the_exit", () => {
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    fireEvent(exit, pointer("pointerdown", 200));
    fireEvent(exit, pointer("pointermove", 260));
    fireEvent(exit, pointer("pointerup", 260));

    expect(push).not.toHaveBeenCalled();
    expect(pull(exit)).toBe("0.000");
  });

  it("test_a_cancelled_pointer_leaves_nothing_armed", () => {
    // The system takes the pointer away (a call, a notification gesture).
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX / 2);
    fireEvent(exit, pointer("pointercancel", 200 - PULL_EXIT_DISTANCE_PX / 2));

    expect(push).not.toHaveBeenCalled();
    expect(pull(exit)).toBe("0.000");
  });

  it("test_the_arming_buzz_fires_once_not_every_frame", () => {
    // The crossing is the event, not the state above it. A pulse per frame
    // past the line is a rumble, and a rumble carries no information.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    fireEvent(exit, pointer("pointerdown", 200));
    for (const dy of [
      PULL_EXIT_DISTANCE_PX,
      PULL_EXIT_DISTANCE_PX + 20,
      PULL_EXIT_DISTANCE_PX + 60,
    ]) {
      fireEvent(exit, pointer("pointermove", 200 - dy));
    }

    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it("test_falling_back_under_the_line_lets_the_buzz_arm_again", () => {
    // Pulling back down un-arms, so the user gets the same confirmation when
    // they commit a second time.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    fireEvent(exit, pointer("pointerdown", 200));
    fireEvent(exit, pointer("pointermove", 200 - PULL_EXIT_DISTANCE_PX));
    fireEvent(exit, pointer("pointermove", 200 - PULL_EXIT_DISTANCE_PX / 2));
    fireEvent(exit, pointer("pointermove", 200 - PULL_EXIT_DISTANCE_PX));

    expect(pulse).toHaveBeenCalledTimes(2);
  });

  it("test_a_pull_that_never_reaches_the_line_stays_silent", () => {
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX - 4);

    expect(pulse).not.toHaveBeenCalled();
  });

  it("test_a_completed_pull_does_not_navigate_twice", () => {
    // The click that trails a pull ending ON the button would repeat a trip
    // the pointer handler already made.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    pullUp(exit, PULL_EXIT_DISTANCE_PX);
    fireEvent(exit, pointer("pointerup", 200 - PULL_EXIT_DISTANCE_PX));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(exit, click);

    expect(push).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
  });

  it("test_the_exit_is_a_real_link_for_keyboard_and_broken_hydration", () => {
    // Keyboard and screen reader users have no drag available, and none of
    // these handlers exist before the screen hydrates. Both fall back to the
    // same plain href.
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);

    expect(exitButton()).toHaveAttribute("href", "/danas");
  });

  it("test_the_exit_says_what_it_wants_and_when_it_will_fire", () => {
    render(<JarvisTopBar mode="voice" onModeChange={vi.fn()} />);
    const exit = exitButton();

    expect(screen.getByText("Prevuci na gore da izađeš")).toBeInTheDocument();

    pullUp(exit, PULL_EXIT_DISTANCE_PX);

    expect(screen.getByText("Pusti da izađeš")).toBeInTheDocument();
  });
});
