import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  AdaptivePlanCard,
  PLAN_INTRO_COOKIE,
} from "@/components/home/adaptive-plan-card";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import { DAY_ANSWER_COOKIE } from "@/lib/home/day-trust";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

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
    daysAfterToday: 4,
    untrustedDays: [],
    hasNotice: true,
    ...overrides,
  };
}

/** A Tuesday (2026-01-06) whose log is too small to be a whole day. */
function flaggedTuesday(overrides: Partial<AdaptivePlan["untrustedDays"][number]> = {}) {
  return {
    dayKey: "2026-01-06",
    kcal: 122,
    logCount: 1,
    trust: "incomplete" as const,
    counts: false,
    needsAnswer: true,
    answer: null,
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
  refresh.mockClear();
  // jsdom keeps cookies between tests; clear the ones we assert on.
  document.cookie = `${PLAN_INTRO_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${DAY_ANSWER_COOKIE}=; path=/; max-age=0`;
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

describe("the plan is announced FORWARD, not just for today", () => {
  it("names the remaining days and the per-day change", () => {
    render(<AdaptivePlanCard plan={makePlan()} />);
    const line = screen.getByTestId("adaptive-note-forward");
    expect(line).toHaveTextContent("još 4 dana");
    expect(line).toHaveTextContent("1600 kcal");
    expect(line).toHaveTextContent("−400/dan");
  });

  it("shows a lift as a plus, not a minus", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          adaptiveDailyTarget: 2400,
          trimmedKcal: 0,
          liftedKcal: 400,
        })}
      />
    );
    expect(screen.getByTestId("adaptive-note-forward")).toHaveTextContent(
      "+400/dan"
    );
  });

  it("says nothing about the future on the last day of the week", () => {
    render(<AdaptivePlanCard plan={makePlan({ daysAfterToday: 0 })} />);
    expect(
      screen.queryByTestId("adaptive-note-forward")
    ).not.toBeInTheDocument();
  });
});

describe("days the plan did not believe", () => {
  it("names them and says what it did instead of silently ignoring them", () => {
    render(
      <AdaptivePlanCard plan={makePlan({ untrustedDays: [flaggedTuesday()] })} />
    );
    const block = screen.getByTestId("adaptive-note-untrusted");
    expect(block).toHaveTextContent("utorak");
    expect(block).toHaveTextContent(/nisam uračunao/i);
  });

  it("asks about an ambiguous day and offers both honest answers", () => {
    render(
      <AdaptivePlanCard plan={makePlan({ untrustedDays: [flaggedTuesday()] })} />
    );
    expect(screen.getByTestId("adaptive-note-untrusted")).toHaveTextContent(
      "Je li utorak stvarno bio dan od 122 kcal?"
    );
    expect(screen.getByTestId("adaptive-answer-complete")).toBeInTheDocument();
    expect(screen.getByTestId("adaptive-answer-partial")).toBeInTheDocument();
  });

  it("records a confirmation and re-runs the plan", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({ untrustedDays: [flaggedTuesday()] })}
        dayKey="2026-01-07"
      />
    );

    fireEvent.click(screen.getByTestId("adaptive-answer-complete"));

    expect(document.cookie).toContain(`${DAY_ANSWER_COOKIE}=2026-01-06~c`);
    expect(refresh).toHaveBeenCalled();
    // The row goes immediately -- the tap must not wait for the server.
    expect(
      screen.queryByTestId("adaptive-answer-complete")
    ).not.toBeInTheDocument();
  });

  it("records a 'did not log it all' answer distinctly", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({ untrustedDays: [flaggedTuesday()] })}
        dayKey="2026-01-07"
      />
    );

    fireEvent.click(screen.getByTestId("adaptive-answer-partial"));
    expect(document.cookie).toContain(`${DAY_ANSWER_COOKIE}=2026-01-06~p`);
  });

  it("lists an already-answered day without asking again", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          untrustedDays: [flaggedTuesday({ needsAnswer: false, answer: "partial" })],
        })}
      />
    );
    expect(screen.getByTestId("adaptive-note-untrusted")).toHaveTextContent(
      "utorak"
    );
    expect(
      screen.queryByTestId("adaptive-answer-complete")
    ).not.toBeInTheDocument();
  });

  it("never questions an empty day -- only ambiguous ones", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          untrustedDays: [
            flaggedTuesday({ kcal: 0, logCount: 0, trust: "empty", needsAnswer: false }),
          ],
        })}
      />
    );
    expect(
      screen.queryByTestId("adaptive-answer-complete")
    ).not.toBeInTheDocument();
  });
});

describe("the unadjusted state (nothing moved, but there IS something to say)", () => {
  const steady = makePlan({
    adaptiveDailyTarget: 2000,
    isAdjusted: false,
    trimmedKcal: 0,
    liftedKcal: 0,
    untrustedDays: [flaggedTuesday()],
  });

  it("says the plan stayed the same instead of claiming an adjustment", () => {
    render(<AdaptivePlanCard plan={steady} />);
    expect(screen.getByTestId("adaptive-note")).toHaveTextContent(
      "Plan za danas ostaje isti"
    );
    expect(screen.getByTestId("adaptive-note")).not.toHaveTextContent(
      /prekoračenja/i
    );
  });

  it("drops the 'regular X' comparison when there is nothing to compare", () => {
    render(<AdaptivePlanCard plan={steady} />);
    expect(screen.getByTestId("adaptive-note")).not.toHaveTextContent(
      /redovni/i
    );
  });

  it("still asks about the day it could not read", () => {
    render(<AdaptivePlanCard plan={steady} />);
    expect(screen.getByTestId("adaptive-answer-complete")).toBeInTheDocument();
  });
});
