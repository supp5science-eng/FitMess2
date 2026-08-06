"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Footprints, TrendingDown, TrendingUp } from "lucide-react";

import { useCountUp } from "@/components/home/animated-number";
import { useT } from "@/components/i18n/locale-provider";
import type { AdaptivePlan } from "@/lib/home/adaptive";

import "./plan-intro.css";

// The once-a-day moment that says WHY today's number isn't the usual one.
//
// History worth keeping: this used to be a permanent card under the pager
// (`adaptive-plan-card.tsx`, deleted 2026-08-01). It was removed because a
// card has to say something every single day, and on the days nothing moved
// it said "Plan za danas ostaje isti" above a number the ring already showed
// -- furniture that charged rent on every other element. The engine kept
// running and kept moving the ring silently, which is why the feature read as
// "not working": the numbers changed and nothing ever explained them.
//
// A moment has none of that cost. It appears only when there is a real change
// to report (`isMaterial`), speaks once, and leaves the dashboard exactly as
// it is for the rest of the day. There is deliberately NO "nothing changed"
// state: silence is the correct output when there is nothing to say.
//
// Ordering rules carried over from the card (agreed 2026-08-01):
//   * lead with the SOLUTION (today's number), then the cause -- a day is not
//     opened with an accusation, the same reason an overshoot is never red;
//   * advice only ever through walking, never prescribed training;
//   * name ONE day, not a list.

/** Day key in the cookie, so a new day re-arms without touching the expiry.
 * Two days of slack so a late-night visit can't wrap into "already seen". */
const PLAN_COOKIE_MAX_AGE = 60 * 60 * 48;

export const PLAN_INTRO_COOKIE = "fm_plan";

/** Count-up length -- long enough to read as a change, short enough that
 * nobody waits for it. Matches the card's original tuning. */
const NUMBER_TWEEN_MS = 900;

/** When the number starts moving, and when the moment bows out on its own. */
const NUMBER_START_MS = 420;
const AUTO_DISMISS_MS = 4600;
/** Fade-out length; must match `.pi[data-stage="out"]` in the CSS. */
const FADE_OUT_MS = 420;

function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Module scope on purpose: writing `document.cookie` from a component body
 * trips `react-hooks/immutability`, and the write is not React state anyway. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

/** `"2026-01-06"` -> 0 = Monday .. 6 = Sunday. */
function weekdayIndexOf(dayKey: string): number {
  const utcDay = new Date(`${dayKey}T12:00:00.000Z`).getUTCDay();
  return (utcDay + 6) % 7;
}

/** The calendar day before `dayKey`. "juče" beats "četvrtak" when they are the
 * same day -- nobody counts backwards to work out which weekday yesterday was. */
function previousDay(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * `prefers-reduced-motion`, as a value rather than as an effect.
 *
 * `useSyncExternalStore` reads it during render. The server snapshot is `false`
 * (the server cannot know) and React reuses that snapshot for hydration, so the
 * first client render still matches the server -- which is exactly why this
 * cannot be a lazy `useState` initializer: that WOULD read `matchMedia` during
 * hydration and mismatch. `revealed` picks WHICH number is shown, not merely
 * whether it animates, so it has to be right on the very first paint.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => reducedMotionQuery()?.matches ?? false,
    () => false
  );
}

type Stage = "in" | "out" | "gone";

export function PlanIntro({
  plan,
  dayKey,
}: {
  plan: AdaptivePlan;
  /** Belgrade day key, stored in the cookie so the moment is once PER DAY. */
  dayKey: string;
}) {
  const { t } = useT();
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("in");
  const [revealedState, setRevealed] = useState(false);

  // Reduced motion lands on the END state by DERIVING it, never by setting it
  // in an effect: no second render pass for the users least able to afford one.
  const revealed = revealedState || reducedMotion;

  const shownTarget = useCountUp(
    revealed ? plan.adaptiveDailyTarget : plan.baseDailyTarget,
    revealed ? "adaptive" : "base",
    NUMBER_TWEEN_MS
  );

  useEffect(() => {
    // Burn the cookie immediately rather than when the moment ends: if the user
    // navigates away mid-animation the moment still counts as spent. Replaying
    // it on the next tap would be worse than missing it once.
    try {
      writeCookie(PLAN_INTRO_COOKIE, dayKey, PLAN_COOKIE_MAX_AGE);
    } catch {
      // A blocked cookie only means the moment may replay -- never a crash.
    }
  }, [dayKey]);

  // The entrance chain, owned by MOUNT rather than by `stage`.
  //
  // ⚠️ It cannot depend on `stage`: an effect that both reads `stage` and
  // schedules the timer that CHANGES it cleans itself up the moment it fires,
  // cancelling its own follow-up. The first version did exactly that -- the
  // "out" timer killed the "gone" timer, the component never unmounted, and
  // the nav-lock effect below (which only releases on "gone") left the bottom
  // navigation hidden for the rest of the session.
  useEffect(() => {
    const timers: number[] = [];
    // Under reduced motion the number is already at its end value; only the
    // auto-dismiss still has work to do.
    if (!reducedMotion) {
      timers.push(window.setTimeout(() => setRevealed(true), NUMBER_START_MS));
    }
    timers.push(
      // Functional, so a tap that already dismissed the moment wins: without
      // it this timer would resurrect a screen the user has closed.
      window.setTimeout(
        () => setStage((previous) => (previous === "in" ? "out" : previous)),
        AUTO_DISMISS_MS
      )
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reducedMotion]);

  // The fade-out, owned by the "out" state itself -- reached either by the
  // timer above or by a tap, and unmounting the same way from both.
  useEffect(() => {
    if (stage !== "out") return;
    const id = window.setTimeout(() => setStage("gone"), FADE_OUT_MS);
    return () => window.clearTimeout(id);
  }, [stage]);

  // Hide the floating bottom nav while the moment is up, the same way the
  // onboarding hand-off does -- the tab bar showing through a full-screen
  // message reads as two screens stacked rather than one moment.
  useEffect(() => {
    if (stage === "gone") return;
    const root = document.documentElement;
    root.classList.add("intro-lock-nav");
    return () => root.classList.remove("intro-lock-nav");
  }, [stage]);

  if (stage === "gone") return null;

  function dismiss() {
    setStage("out");
    window.setTimeout(() => setStage("gone"), FADE_OUT_MS);
  }

  const lifted = plan.liftedKcal > 0;
  const Icon = lifted ? TrendingUp : TrendingDown;
  /** Did the NUMBER move, as opposed to only the activity suggestion? */
  const moved = plan.trimmedKcal > 0 || plan.liftedKcal > 0;

  const weekdayNames = t("home.adaptive.weekdays").split(" ");
  const dayName = (key: string) => weekdayNames[weekdayIndexOf(key)] ?? key;

  // ONE reason, not a list -- `causeDays` is already sorted by deviation.
  const cause = plan.causeDays[0] ?? null;
  const yesterdayKey = previousDay(dayKey);
  // "juče" is an adverb and cannot stand where a weekday NAME stands:
  // "četvrtak je bio 500 kcal veći" is Serbian, "juče je bio veći" is not.
  // Hence a whole separate sentence rather than a swapped-in word.
  const causeMessageKey = !cause
    ? null
    : cause.dayKey === yesterdayKey
      ? cause.deltaKcal > 0
        ? "home.adaptive.causeOverYesterday"
        : "home.adaptive.causeUnderYesterday"
      : cause.deltaKcal > 0
        ? "home.adaptive.causeOver"
        : "home.adaptive.causeUnder";

  // Ordered entrance; each line declares its own beat.
  let beat = 0;
  const nextDelay = () =>
    ({ "--pi-delay": `${beat++ * 110 + 240}ms` }) as React.CSSProperties;

  return (
    <div
      data-testid="plan-intro"
      data-stage={stage}
      className="pi"
      role="button"
      tabIndex={0}
      aria-label={t("home.planIntro.title")}
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") dismiss();
      }}
    >
      <div className="pi-body">
        <p className="pi-line pi-title" style={nextDelay()}>
          {t("home.planIntro.title")}
        </p>

        <p className="pi-line pi-number" style={nextDelay()}>
          <span data-testid="plan-intro-target" className="pi-kcal">
            {formatNumber(shownTarget)}
          </span>
          <span className="pi-unit">kcal</span>
        </p>

        {/* Only when the number actually moved. A target already at or below
            the sex floor can be left at base while still needing activity
            (`trainingSuggestionKcal > 0` with nothing trimmed) -- and "2.000 ↓
            sa 2.000" is a line that makes the screen look broken. */}
        {moved ? (
          <p className="pi-line pi-from" style={nextDelay()}>
            <Icon className="size-4" aria-hidden="true" />
            {t("home.planIntro.from", {
              kcal: formatNumber(plan.baseDailyTarget),
            })}
          </p>
        ) : null}

        {/* WHY, under the number rather than over it. When a specific day can
            be named the generic sentence is redundant, so it is REPLACED --
            never stacked on top of. */}
        <p
          data-testid="plan-intro-cause"
          className="pi-line pi-cause"
          style={nextDelay()}
        >
          {cause && causeMessageKey
            ? t(causeMessageKey, {
                day: dayName(cause.dayKey),
                kcal: formatNumber(Math.abs(cause.deltaKcal)),
              })
            : lifted
              ? t("home.adaptive.lifted")
              : t("home.adaptive.lowered")}
          {plan.carryInKcal > 0 ? (
            <>
              {" "}
              {t("home.adaptive.carry", {
                kcal: formatNumber(plan.carryInKcal),
              })}
            </>
          ) : null}
        </p>

        {/* The only advice this screen gives. Never sets or training volume:
            the app knows neither what the user trains nor whether they are
            injured, and a set is 15-30 kcal -- not a lever. */}
        {plan.trainingSuggestionKcal > 0 ? (
          <p
            data-testid="plan-intro-walk"
            className="pi-line pi-walk"
            style={nextDelay()}
          >
            <Footprints className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {t("home.planIntro.walk", { min: plan.trainingWalkMinutes })}
            </span>
          </p>
        ) : null}

        {/* What the change means going FORWARD: the redistribution spreads
            evenly over every remaining day, so saying only "today is 2.140"
            hides the fact that a plan was actually made. */}
        {moved && plan.daysAfterToday > 0 ? (
          <p
            data-testid="plan-intro-forward"
            className="pi-line pi-forward"
            style={nextDelay()}
          >
            {t("home.adaptive.forward", {
              days: plan.daysAfterToday,
              unit:
                plan.daysAfterToday === 1
                  ? t("home.adaptive.day")
                  : t("home.adaptive.days"),
              kcal: formatNumber(plan.adaptiveDailyTarget),
              delta: `${lifted ? "+" : "−"}${formatNumber(
                lifted ? plan.liftedKcal : plan.trimmedKcal
              )}`,
            })}
          </p>
        ) : null}

        {/* The part this week genuinely cannot absorb. It used to vanish from
            the story even though it returns as next week's carry-in. */}
        {plan.spillToNextWeekKcal > 0 ? (
          <p
            data-testid="plan-intro-spill"
            className="pi-line pi-spill"
            style={nextDelay()}
          >
            {t("home.adaptive.spill", {
              kcal: formatNumber(plan.spillToNextWeekKcal),
            })}
          </p>
        ) : null}

        <p className="pi-line pi-dismiss" style={nextDelay()}>
          {t("home.planIntro.dismiss")}
        </p>
      </div>
    </div>
  );
}
