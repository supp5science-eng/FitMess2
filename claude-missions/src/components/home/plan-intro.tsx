"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Footprints, TrendingDown, TrendingUp } from "lucide-react";

import { useCountUp } from "@/components/home/animated-number";
import {
  hasPlayedInSession,
  markPlayed,
  playedBeforeThisLoad,
  subscribeToNothing,
} from "@/components/home/once-a-day";
import { formatPlanNumber, planLines } from "@/components/home/plan-lines";
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

/** The device-local record of the day this moment last played. The cookie above
 * ARMS the moment; this is what REMEMBERS it, and the two are not the same job
 * -- see `once-a-day.ts` for the replay bug that separated them. */
const PLAN_MOMENT_KEY = "fm_plan_seen";

/** Count-up length -- long enough to read as a change, short enough that
 * nobody waits for it. Matches the card's original tuning. */
const NUMBER_TWEEN_MS = 900;

/** When the number starts moving, and when the moment bows out on its own. */
const NUMBER_START_MS = 420;
const AUTO_DISMISS_MS = 4600;
/** Fade-out length; must match `.pi[data-stage="out"]` in the CSS. */
const FADE_OUT_MS = 420;

/** Module scope on purpose: writing `document.cookie` from a component body
 * trips `react-hooks/immutability`, and the write is not React state anyway. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
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

  // Layer 1 of "once a day": has this already played in THIS tab?
  //
  // Read during render rather than in an effect on purpose. The server's
  // decision arrives inside an RSC payload the client router may replay on a
  // later navigation -- returning to Početna from Analitika did exactly that,
  // and the sheet came back every single time. Checking here means a replayed
  // payload never paints a frame of a full-screen message the user already
  // dismissed.
  //
  // The lazy initializer runs once per mounted instance, so the instance that
  // is genuinely playing (and marks itself below) can never hide itself
  // mid-animation.
  const [playedInThisTab] = useState(() =>
    hasPlayedInSession(PLAN_MOMENT_KEY, dayKey)
  );

  // Layer 2: a reload or an app relaunch starts a fresh module, so the check
  // above knows nothing about it -- `localStorage` does. This is what keeps
  // "once a day" true even when the cookie never reaches the server.
  //
  // Same shape as `useReducedMotion` below and for the same reason: the server
  // snapshot is `false` and React reuses it for hydration, so the first client
  // render still matches the HTML that was sent. The snapshot is frozen at tab
  // load (see `once-a-day.ts`), so writing the record on mount cannot make this
  // flip to `true` and pull the sheet out from under its own animation.
  const playedOnEarlierLoad = useSyncExternalStore(
    subscribeToNothing,
    () => playedBeforeThisLoad(PLAN_MOMENT_KEY, dayKey),
    () => false
  );

  const alreadyHadItsTurn = playedInThisTab || playedOnEarlierLoad;

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
    // The device-local record is written in the same breath and for the same
    // reason. Unconditional: when the moment is being suppressed this simply
    // re-states what is already true, and it keeps the record fresh on a day
    // the server armed a moment the device had already spent.
    markPlayed(PLAN_MOMENT_KEY, dayKey);
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
    if (alreadyHadItsTurn || stage === "gone") return;
    const root = document.documentElement;
    root.classList.add("intro-lock-nav");
    return () => root.classList.remove("intro-lock-nav");
  }, [alreadyHadItsTurn, stage]);

  if (alreadyHadItsTurn || stage === "gone") return null;

  function dismiss() {
    setStage("out");
    window.setTimeout(() => setStage("gone"), FADE_OUT_MS);
  }

  const lines = planLines(plan, dayKey, t);
  const Icon = lines.lifted ? TrendingUp : TrendingDown;

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
            {formatPlanNumber(shownTarget)}
          </span>
          <span className="pi-unit">kcal</span>
        </p>

        {/* Only when the number actually moved. A target already at or below
            the sex floor can be left at base while still needing activity
            (`trainingSuggestionKcal > 0` with nothing trimmed) -- and "2.000 ↓
            sa 2.000" is a line that makes the screen look broken. */}
        {lines.moved ? (
          <p className="pi-line pi-from" style={nextDelay()}>
            <Icon className="size-4" aria-hidden="true" />
            {t("home.planIntro.from", {
              kcal: formatPlanNumber(plan.baseDailyTarget),
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
          {lines.cause}
        </p>

        {/* The only advice this screen gives. Never sets or training volume:
            the app knows neither what the user trains nor whether they are
            injured, and a set is 15-30 kcal -- not a lever. */}
        {lines.walk ? (
          <p
            data-testid="plan-intro-walk"
            className="pi-line pi-walk"
            style={nextDelay()}
          >
            <Footprints className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {lines.walk}
            </span>
          </p>
        ) : null}

        {/* What the change means going FORWARD: the redistribution spreads
            evenly over every remaining day, so saying only "today is 2.140"
            hides the fact that a plan was actually made. */}
        {lines.forward ? (
          <p
            data-testid="plan-intro-forward"
            className="pi-line pi-forward"
            style={nextDelay()}
          >
            {lines.forward}
          </p>
        ) : null}

        {/* The part this week genuinely cannot absorb. It used to vanish from
            the story even though it returns as next week's carry-in. */}
        {lines.spill ? (
          <p
            data-testid="plan-intro-spill"
            className="pi-line pi-spill"
            style={nextDelay()}
          >
            {lines.spill}
          </p>
        ) : null}

        <p className="pi-line pi-dismiss" style={nextDelay()}>
          {t("home.planIntro.dismiss")}
        </p>
      </div>
    </div>
  );
}
