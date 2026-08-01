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
    causeDays: [],
    spillToNextWeekKcal: 0,
    isMaterial: false,
    weekRoomKcal: 0,
    isOnTrackNotice: false,
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
      "1.600 kcal"
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
      "2.000 kcal"
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
      "1.600 kcal"
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
    expect(line).toHaveTextContent("1.600 kcal");
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

describe("WHY the plan moved", () => {
  const thursdayCause = {
    dayKey: "2026-01-08",
    kcal: 3500,
    deltaKcal: 500,
  };

  it("names the day and the amount, instead of a vague 'earlier overshoot'", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({ causeDays: [thursdayCause] })}
        dayKey="2026-01-10"
      />
    );
    expect(screen.getByTestId("adaptive-note-cause")).toHaveTextContent(
      "Razlog: četvrtak je bio 500 kcal veći od plana."
    );
  });

  // "juče" is an adverb, so it gets its own sentence rather than being dropped
  // into the weekday one: "juče je bio veći" is not Serbian, and the bug is
  // invisible to a test that only asserts the word "juče" appears.
  it("says 'juče' when the cause was yesterday -- nobody counts weekdays back", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({ causeDays: [thursdayCause] })}
        dayKey="2026-01-09"
      />
    );
    expect(screen.getByTestId("adaptive-note-cause")).toHaveTextContent(
      "Razlog: juče je uneto 500 kcal više od plana."
    );
  });

  it("keeps the yesterday sentence grammatical when the day was UNDER plan", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          causeDays: [{ ...thursdayCause, kcal: 1500, deltaKcal: -500 }],
        })}
        dayKey="2026-01-09"
      />
    );
    expect(screen.getByTestId("adaptive-note-cause")).toHaveTextContent(
      "Razlog: juče je uneto 500 kcal manje od plana."
    );
  });

  it("phrases an under-eaten cause as under, not over", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({
          liftedKcal: 400,
          trimmedKcal: 0,
          adaptiveDailyTarget: 2400,
          causeDays: [{ dayKey: "2026-01-08", kcal: 1200, deltaKcal: -800 }],
        })}
        dayKey="2026-01-10"
      />
    );
    expect(screen.getByTestId("adaptive-note-cause")).toHaveTextContent(
      "800 kcal manji od plana"
    );
  });

  it("falls back to the generic sentence when no single day is to blame", () => {
    render(<AdaptivePlanCard plan={makePlan({ causeDays: [] })} />);
    expect(screen.getByTestId("adaptive-note-cause")).toHaveTextContent(
      /prekoračenja/i
    );
  });

  it("leads with the solution: the target renders before the reason", () => {
    render(
      <AdaptivePlanCard
        plan={makePlan({ causeDays: [thursdayCause] })}
        dayKey="2026-01-10"
      />
    );
    const card = screen.getByTestId("adaptive-note");
    const target = screen.getByTestId("adaptive-note-target");
    const reason = screen.getByTestId("adaptive-note-cause");
    // Node order inside the card decides what the eye reaches first.
    expect(
      card.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING
    ).toBe(0);
    expect(
      target.compareDocumentPosition(reason) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });
});

describe("what this week cannot absorb", () => {
  it("says the leftover rolls into next week instead of letting it vanish", () => {
    render(<AdaptivePlanCard plan={makePlan({ spillToNextWeekKcal: 450 })} />);
    expect(screen.getByTestId("adaptive-note-spill")).toHaveTextContent(
      "450 kcal"
    );
  });

  it("stays silent when the week absorbs everything", () => {
    render(<AdaptivePlanCard plan={makePlan()} />);
    expect(screen.queryByTestId("adaptive-note-spill")).not.toBeInTheDocument();
  });
});

describe("good news, so the card is not only ever bad news", () => {
  const ahead = makePlan({
    isAdjusted: false,
    trimmedKcal: 0,
    adaptiveDailyTarget: 2000,
    weekRoomKcal: 1200,
    isOnTrackNotice: true,
  });

  it("leads with 'the week is on plan' rather than 'nothing changed'", () => {
    render(<AdaptivePlanCard plan={ahead} />);
    expect(screen.getByTestId("adaptive-note")).toHaveTextContent(
      "Nedelja ti je u planu"
    );
  });

  it("states the actual cushion, not just a compliment", () => {
    render(<AdaptivePlanCard plan={ahead} />);
    expect(screen.getByTestId("adaptive-note-room")).toHaveTextContent(
      "1.200 kcal"
    );
  });

  it("does not appear alongside a trim -- one story at a time", () => {
    render(<AdaptivePlanCard plan={makePlan()} />);
    expect(screen.queryByTestId("adaptive-note-room")).not.toBeInTheDocument();
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
