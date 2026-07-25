import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

import {
  AdaptivePlanCard,
  PLAN_INTRO_COOKIE,
} from "@/components/home/adaptive-plan-card";
import type { AdaptivePlan } from "@/lib/home/adaptive";

function makePlan(overrides: Partial<AdaptivePlan> = {}): AdaptivePlan {
  return {
    baseDailyTarget: 2000,
    adaptiveDailyTarget: 1600,
    isAdjusted: true,
    weeklyBudget: 14000,
    spentBeforeToday: 6000,
    daysLeftIncludingToday: 5,
    carryInKcal: 0,
    trimmedKcal: 400,
    liftedKcal: 0,
    trainingSuggestionKcal: 0,
    trainingWalkMinutes: 0,
    adaptiveStepGoal: 10000,
    extraSteps: 0,
    ...overrides,
  };
}

/** Control `prefers-reduced-motion` per test. */
function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

beforeEach(() => {
  stubMatchMedia(false);
  // jsdom keeps cookies between tests; clear the one we assert on.
  document.cookie = `${PLAN_INTRO_COOKIE}=; path=/; max-age=0`;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the calm state (every visit after the first one that day)", () => {
  it("renders today's adapted target with no reveal animation", () => {
    render(<AdaptivePlanCard plan={makePlan()} />);

    expect(screen.getByTestId("adaptive-note-target")).toHaveTextContent(
      "1600 kcal"
    );
    // No intro class -> none of the entrance animations are armed.
    expect(screen.getByTestId("adaptive-note").className).not.toContain(
      "apc-intro"
    );
  });

  it("explains a TRIM and a LIFT differently -- they are opposite situations", () => {
    const { unmount } = render(<AdaptivePlanCard plan={makePlan()} />);
    expect(screen.getByTestId("adaptive-note")).toHaveTextContent(
      /prekoračenja/i
    );
    unmount();

    render(
      <AdaptivePlanCard
        plan={makePlan({
          adaptiveDailyTarget: 2400,
          trimmedKcal: 0,
          liftedKcal: 400,
        })}
      />
    );
    expect(screen.getByTestId("adaptive-note")).toHaveTextContent(
      /uneo manje/i
    );
  });

  it("mentions a carried-in debt only when there is one", () => {
    const { unmount } = render(<AdaptivePlanCard plan={makePlan()} />);
    expect(screen.getByTestId("adaptive-note")).not.toHaveTextContent(
      /prenos/i
    );
    unmount();

    render(<AdaptivePlanCard plan={makePlan({ carryInKcal: 900 })} />);
    expect(screen.getByTestId("adaptive-note")).toHaveTextContent(
      /prenos od 900 kcal/i
    );
  });
});

describe("the once-a-day reveal", () => {
  it("starts from the REGULAR target and lands on today's", () => {
    vi.useFakeTimers();
    render(<AdaptivePlanCard plan={makePlan()} intro dayKey="2026-07-25" />);

    // Before the tween starts the card shows the number the user already
    // knows -- the change is what gets animated, so it must begin at 2000.
    expect(screen.getByTestId("adaptive-note-target")).toHaveTextContent(
      "2000 kcal"
    );
    expect(screen.getByTestId("adaptive-note").className).toContain("apc-intro");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // `useCountUp` drives the in-between frames via rAF; what matters here is
    // that the reveal ends on the adapted number and the intro class is gone.
    expect(screen.getByTestId("adaptive-note").className).not.toContain(
      "apc-intro"
    );
  });

  it("burns the cookie immediately, so it cannot replay on the next tap", () => {
    render(<AdaptivePlanCard plan={makePlan()} intro dayKey="2026-07-25" />);

    expect(document.cookie).toContain(`${PLAN_INTRO_COOKIE}=2026-07-25`);
  });

  it("skips straight to the final state under reduced motion", () => {
    stubMatchMedia(true);
    render(<AdaptivePlanCard plan={makePlan()} intro dayKey="2026-07-25" />);

    // No animation classes, and the real number immediately -- motion is
    // decoration here, so removing it must lose nothing.
    expect(screen.getByTestId("adaptive-note").className).not.toContain(
      "apc-intro"
    );
    expect(screen.getByTestId("adaptive-note-target")).toHaveTextContent(
      "1600 kcal"
    );
    // The cookie is still spent -- the moment counts as delivered.
    expect(document.cookie).toContain(`${PLAN_INTRO_COOKIE}=2026-07-25`);
  });
});

describe("the activity suggestion is expressed as a step goal", () => {
  it("names the raised step goal and the extra steps", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          adaptiveDailyTarget: 1500,
          trimmedKcal: 500,
          trainingSuggestionKcal: 250,
          trainingWalkMinutes: 50,
          adaptiveStepGoal: 15000,
          extraSteps: 5000,
        })}
      />
    );

    const line = screen.getByTestId("adaptive-note-training");
    expect(line).toHaveTextContent("~250 kcal");
    expect(line).toHaveTextContent("50 min");
    expect(screen.getByTestId("adaptive-note-steps")).toHaveTextContent("15.000");
    expect(line).toHaveTextContent("+5.000");
  });

  it("says nothing about movement when food alone absorbs the overshoot", () => {
    render(<AdaptivePlanCard plan={makePlan()} />);
    expect(
      screen.queryByTestId("adaptive-note-training")
    ).not.toBeInTheDocument();
  });
});
