"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CircleHelp,
  Footprints,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useCountUp } from "@/components/home/animated-number";
import { useT } from "@/components/i18n/locale-provider";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import {
  DAY_ANSWER_COOKIE,
  withDayAnswer,
  type DayAnswer,
} from "@/lib/home/day-trust";
import { cn } from "@/lib/utils";

import "./adaptive-plan-card.css";

// The home screen's explanation of WHY today's target isn't the usual number.
//
// Two states, one component:
//   - calm (default): the quiet card the user sees on every visit after the
//     first one that day.
//   - intro (`intro` prop): the once-a-day reveal. The number counts from the
//     regular target down/up to today's, the week bar fills, and the reasons
//     stagger in. Then it settles into the calm state and stays there.
//
// Why once a day and not every visit: an animation that replays on every
// navigation stops being a moment and becomes a stutter. The server decides
// (via the `fm_plan` cookie) and this component consumes it -- writing the
// cookie itself the first time it plays, so a refresh five seconds later is
// already calm.

/** How long the cookie suppresses a replay. Two days so a late-night visit
 * can't wrap around into "already seen" for tomorrow; the value is the day key
 * anyway, so correctness never depends on the expiry. */
const PLAN_COOKIE_MAX_AGE = 60 * 60 * 48;

export const PLAN_INTRO_COOKIE = "fm_plan";

/** Count-up length for the target number -- long enough to read as a change,
 * short enough that nobody waits for it. */
const NUMBER_TWEEN_MS = 900;

/** When the number starts moving, and when the whole reveal is over. */
const NUMBER_START_MS = 380;
const SETTLE_MS = 2100;

/** How long an answer about a past day is remembered. Comfortably longer than
 * the 21-day window the plan itself looks back over. */
const DAY_ANSWER_MAX_AGE = 60 * 60 * 24 * 60;

/**
 * `10000` -> `"10.000"` (Serbian thousands separator).
 *
 * Applies to kcal as well as steps: this card puts a weekly budget and a step
 * goal within two lines of each other, and "21994 kcal" next to "13.000
 * koraka" reads as two different number systems. Deliberately a regex rather
 * than `toLocaleString`, so the separator cannot shift with the runtime's ICU
 * data -- the tests assert the exact string.
 */
function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Module scope on purpose: writing `document.cookie` from a component body
 * trips `react-hooks/immutability`, and the write is not React state anyway. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]!) : null;
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
 * This used to be a plain function called inside the reveal effect, which then
 * called `setPlaying(false)` / `setRevealed(true)` to land on the end state --
 * a setState synchronously inside an effect body, i.e. a guaranteed second
 * render pass on every mount for the users least able to afford one.
 *
 * `useSyncExternalStore` reads it during render instead. The server snapshot is
 * `false` (the server cannot know), and React uses that same snapshot for
 * hydration, so the first client render still matches the server exactly --
 * which is why this cannot be a lazy `useState` initializer: that WOULD read
 * `matchMedia` during hydration and mismatch.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => reducedMotionQuery()?.matches ?? false,
    () => false
  );
}

export function AdaptivePlanCard({
  plan,
  intro = false,
  dayKey,
}: {
  plan: AdaptivePlan;
  /** First visit of the day AND the plan is adjusted -> play the reveal. */
  intro?: boolean;
  /** Belgrade day key stored in the cookie so the reveal is once PER DAY. */
  dayKey?: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  // `playing` drives the CSS; `revealed` flips the count-up's target.
  const [playingState, setPlaying] = useState(intro);
  const [revealedState, setRevealed] = useState(!intro);
  // Reduced motion lands on the END state by DERIVING it, not by setting it:
  // the reveal is skipped and the adapted number is shown straight away, with
  // no extra render to get there. `revealed` also picks WHICH number is shown
  // (adapted vs base), so it has to be right on the very first paint -- not
  // merely un-animated.
  const playing = playingState && !reducedMotion;
  const revealed = revealedState || reducedMotion;

  const shownTarget = useCountUp(
    revealed ? plan.adaptiveDailyTarget : plan.baseDailyTarget,
    revealed ? "adaptive" : "base",
    NUMBER_TWEEN_MS
  );

  useEffect(() => {
    if (!intro) return;

    // Burn the cookie immediately, not when the animation ends: if the user
    // navigates away mid-reveal, the moment still counts as spent. Replaying it
    // on the next tap would be worse than missing it once.
    if (dayKey) {
      try {
        document.cookie = `${PLAN_INTRO_COOKIE}=${dayKey}; path=/; max-age=${PLAN_COOKIE_MAX_AGE}; samesite=lax`;
      } catch {
        // A blocked cookie only means the reveal may replay -- never a crash.
      }
    }

    // Nothing to schedule: the derived values above are already at the end
    // state. The cookie above still had to be burned -- the moment was spent
    // either way.
    if (reducedMotion) return;

    const timers = [
      window.setTimeout(() => setRevealed(true), NUMBER_START_MS),
      window.setTimeout(() => setPlaying(false), SETTLE_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [intro, dayKey, reducedMotion]);

  const lifted = plan.liftedKcal > 0;
  const adjusted = plan.isAdjusted;
  const Icon = !adjusted ? Minus : lifted ? TrendingUp : TrendingDown;

  // Days the plan deliberately did NOT believe. Answering one hides its row
  // immediately (the server refresh that follows is the authority, but the tap
  // has to feel instant) and re-runs the plan with the answer applied.
  const [answered, setAnswered] = useState<string[]>([]);
  const asked = plan.untrustedDays.filter(
    (day) => day.needsAnswer && !answered.includes(day.dayKey)
  );

  function answerDay(untrustedDayKey: string, answer: DayAnswer) {
    setAnswered((previous) => [...previous, untrustedDayKey]);
    try {
      const next = withDayAnswer(
        readCookie(DAY_ANSWER_COOKIE),
        untrustedDayKey,
        answer,
        dayKey ?? untrustedDayKey
      );
      writeCookie(DAY_ANSWER_COOKIE, next, DAY_ANSWER_MAX_AGE);
    } catch {
      // A blocked cookie costs the answer, never the screen.
    }
    router.refresh();
  }

  const weekdayNames = t("home.adaptive.weekdays").split(" ");
  const dayName = (key: string) =>
    weekdayNames[weekdayIndexOf(key)] ?? key;

  // The single day most responsible for the change -- the plan names one
  // reason, not a list. `causeDays` is already sorted by deviation.
  const cause = plan.causeDays[0] ?? null;
  const yesterdayKey = dayKey ? previousDay(dayKey) : null;
  // "juče" is an adverb, so it cannot stand where a weekday NAME stands:
  // "četvrtak je bio 500 kcal veći" is fine, "juče je bio" is not Serbian.
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

  // Week bar geometry: how much of the weekly budget is already gone, and the
  // slice today is allowed to take out of what remains.
  const budget = Math.max(1, plan.weeklyBudget);
  const spentPct = Math.min(100, (plan.spentBeforeToday / budget) * 100);
  const todayPct = Math.min(100 - spentPct, (plan.adaptiveDailyTarget / budget) * 100);

  // Ordered entrance; each line declares its own beat.
  let beat = 0;
  const nextDelay = () => ({ "--apc-delay": `${(beat++ * 110) + 120}ms` }) as React.CSSProperties;

  return (
    <div
      data-testid="adaptive-note"
      className={cn(
        "apc home-body rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm",
        playing && "apc-intro"
      )}
    >
      {playing ? <span className="apc-sweep" aria-hidden="true" /> : null}

      <p
        className="apc-line flex items-center gap-1.5 font-semibold text-foreground"
        style={nextDelay()}
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        {adjusted ? t("home.adaptive.adjusted") : t("home.adaptive.unchanged")}
      </p>

      <p
            className="apc-line mt-1.5 flex items-baseline gap-2"
            style={nextDelay()}
          >
            <Icon
              className="size-4 shrink-0 self-center text-primary"
              aria-hidden="true"
            />
            <span
              data-testid="adaptive-note-target"
              className="text-2xl font-semibold tabular-nums text-foreground"
            >
              {formatNumber(shownTarget)} kcal
            </span>
            {adjusted ? (
              <span className="text-xs text-muted-foreground">
                {t("home.adaptive.regular", {
                  kcal: formatNumber(plan.baseDailyTarget),
                })}
              </span>
            ) : null}
          </p>

          <div className="apc-line mt-2.5" style={nextDelay()}>
            <div
              className="apc-bar"
              style={
                {
                  "--apc-fill": `${spentPct}%`,
                  "--apc-today-left": `${spentPct}%`,
                  "--apc-today-width": `${todayPct}%`,
                } as React.CSSProperties
              }
              role="presentation"
            >
              <div className="apc-bar-fill" />
              <div className="apc-bar-today" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("home.adaptive.weekSpent", {
                spent: formatNumber(plan.spentBeforeToday),
                budget: formatNumber(plan.weeklyBudget),
                days: plan.daysLeftIncludingToday,
                unit:
                  plan.daysLeftIncludingToday === 1
                    ? t("home.adaptive.day")
                    : t("home.adaptive.days"),
              })}
        </p>
      </div>

      {/* What the change means going FORWARD. The redistribution already
          spreads evenly over every remaining day, so the same number holds for
          the rest of the week -- saying only "today is 2.890" hid the fact
          that a plan was actually made. */}
      {adjusted && plan.daysAfterToday > 0 ? (
        <p
          data-testid="adaptive-note-forward"
          className="apc-line mt-2 text-xs text-muted-foreground"
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

      {/* The good news ("Nedelja ti je u planu") is NOT here (2026-08-01,
          product owner's call). It moved to the top of /analitika, where a
          standing on the week belongs: this card exists for things that need
          doing TODAY, and a week that needs nothing done is exactly the case
          that should not occupy the home screen. See
          `components/analytics/week-on-track-note.tsx`. */}

      {/* WHY, placed under the solution rather than over it. Leading with
          "Thursday was 500 kcal over" opens the day with an accusation -- the
          same reason an overshoot is never shown in red. When a specific day
          can be named the generic sentence is redundant, so it is replaced,
          not stacked on top of. */}
      {adjusted ? (
        <p
          data-testid="adaptive-note-cause"
          className="apc-line mt-2 text-muted-foreground"
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
      ) : null}

      {/* The part this week genuinely cannot absorb. It used to vanish from
          the story even though it comes back as next week's carry-in. */}
      {adjusted && plan.spillToNextWeekKcal > 0 ? (
        <p
          data-testid="adaptive-note-spill"
          className="apc-line mt-2 text-xs text-muted-foreground"
          style={nextDelay()}
        >
          {t("home.adaptive.spill", {
            kcal: formatNumber(plan.spillToNextWeekKcal),
          })}
        </p>
      ) : null}

      {plan.trainingSuggestionKcal > 0 ? (
        <p
          data-testid="adaptive-note-training"
          className="apc-line mt-2 flex items-start gap-1.5 text-muted-foreground"
          style={nextDelay()}
        >
          <Footprints
            className="size-4 shrink-0 translate-y-0.5 text-primary"
            aria-hidden="true"
          />
          <span>
            {t("home.adaptive.trainingLead")}{" "}
            <span className="font-medium text-foreground">
              ~{formatNumber(plan.trainingSuggestionKcal)} kcal
            </span>{" "}
            {t("home.adaptive.trainingWalk", {
              min: plan.trainingWalkMinutes,
            })}{" "}
            <span
              data-testid="adaptive-note-steps"
              className="font-medium text-foreground"
            >
              {formatNumber(plan.adaptiveStepGoal)}
            </span>
            {plan.extraSteps > 0 ? ` (+${formatNumber(plan.extraSteps)})` : null}.
          </span>
        </p>
      ) : null}

      {/* The days the plan refused to believe, and the one question that can
          settle them. Saying this out loud is the difference between "the app
          ignored my Tuesday" and "the app told me why Tuesday didn't count". */}
      {plan.untrustedDays.length > 0 ? (
        <div
          data-testid="adaptive-note-untrusted"
          className="apc-line mt-2.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
          style={nextDelay()}
        >
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CircleHelp
              className="size-3.5 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>
              {t(
                plan.untrustedDays.length === 1
                  ? "home.adaptive.untrustedLead"
                  : "home.adaptive.untrustedLeadPlural",
                {
                  days: plan.untrustedDays
                    .map((day) => dayName(day.dayKey))
                    .join(", "),
                }
              )}
            </span>
          </p>

          {asked.map((day) => (
            <div key={day.dayKey} className="mt-2.5">
              <p className="text-xs text-foreground">
                {t("home.adaptive.askDay", {
                  day: dayName(day.dayKey),
                  kcal: formatNumber(day.kcal),
                })}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="adaptive-answer-complete"
                  onClick={() => answerDay(day.dayKey, "complete")}
                  className="min-h-9 rounded-full border border-border bg-muted/60 px-3 text-xs font-medium text-foreground active:scale-[0.97]"
                >
                  {t("home.adaptive.answerComplete")}
                </button>
                <button
                  type="button"
                  data-testid="adaptive-answer-partial"
                  onClick={() => answerDay(day.dayKey, "partial")}
                  className="min-h-9 rounded-full border border-border bg-muted/60 px-3 text-xs font-medium text-foreground active:scale-[0.97]"
                >
                  {t("home.adaptive.answerPartial")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
