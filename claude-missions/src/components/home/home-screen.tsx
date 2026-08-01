"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { HealthScoreCard } from "@/components/home/health-score-card";
import { IntakePager } from "@/components/home/intake-pager";
import { IntroCover } from "@/components/home/intro-cover";
import { InstallOverlay } from "@/components/pwa/install-overlay";
import { IntakeConfluence } from "@/components/home/intake-confluence";
import { MicroCards } from "@/components/home/micro-cards";
import type { MiniWeekDay } from "@/components/home/mini-week-bars";
import { MealList } from "@/components/home/meal-list";
import { AdaptivePlanCard } from "@/components/home/adaptive-plan-card";
import { StepsCard } from "@/components/home/steps-card";
import { useT } from "@/components/i18n/locale-provider";
import { GricButton } from "@/components/home/gric-button";
import { WaterButton } from "@/components/home/water-button";
import { WeighInBanner } from "@/components/home/weigh-in-banner";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import type { LogWithFood } from "@/lib/home/attach-food";
import { computeDayTotals } from "@/lib/home/totals";
import { computeHealthScore } from "@/lib/nutrition/health-score";
import { computeMicroTotals, microTargetsForKcal } from "@/lib/nutrition/micro";
import { FALLBACK_STEP_GOAL } from "@/lib/steps/step-goal";
import { waterGoalMl } from "@/lib/water/water-week";
import type { Log, Target } from "@/lib/types/db";

// useLayoutEffect on the client (measure + cover before first paint), a no-op
// useEffect on the server (avoids the SSR warning).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const INTRO_COOKIE = "fm_intro";

// idle: no intro (normal visits + tests). cover -> glide -> land: the one-time
// ring hand-off from onboarding. done: intro finished, everything visible.
type IntroStage = "idle" | "cover" | "glide" | "land" | "done";

// F027 / AS-043, AS-047, AS-048, AS-049, AS-050: the `/danas` home screen's
// client shell -- server-fetched initial props (clarified data-shape
// answer), small client state for the one thing that needs to change
// without a navigation: today's log list after an edit/delete.
//
// AS-043 ("Saving a log updates the 'Preostalo danas' display immediately
// without a full page reload"): `LogEditSheet`/`LogDeleteConfirm` (F026)
// already PATCH/DELETE the log row on the server and hand the RESULT back
// via `onSaved`/`onDeleted` callbacks -- this component's only job is to
// fold that result into local state, which re-renders the ring/bars/list
// immediately via plain React state, with zero navigation call
// (`next/navigation`'s router is never imported here). Creating a brand
// NEW log happens on a different route (`/dodaj/porcija/[foodId]`, F025)
// which client-navigates (`router.push`, not a hard reload) back to
// `/danas` on success -- Next's App Router re-fetches this (dynamic,
// cookie-read) page's Server Component data on that navigation, so the
// ring/bars/list are fresh the moment the user lands back here, still
// without a full page reload.
export function HomeScreen({
  initialLogs,
  target,
  intro = false,
  installPrompt = false,
  mealsHeading = "Obroci danas",
  adaptivePlan = null,
  planIntro = false,
  dayKey,
  initialWaterMl = 0,
  initialSteps = 0,
  stepsGoal = FALLBACK_STEP_GOAL,
  waterGoal = waterGoalMl(null),
  stepsWeek = [],
  waterWeek = [],
  isToday = true,
  weighInDaysWaiting = null,
}: {
  initialLogs: LogWithFood[];
  target: Target | null;
  // Set by `/danas` (from the one-time `fm_intro` cookie) when the user has
  // just finished onboarding, so we play the ring hand-off exactly once.
  intro?: boolean;
  // Set by `/danas` (from the one-time `fm_install` cookie, dropped by the
  // plan reveal): right after onboarding, rise the "install FitMess" overlay
  // once the ring hand-off has settled. The overlay consumes the cookie and
  // self-guards, so this can never replay on later visits.
  installPrompt?: boolean;
  // The meals-section heading for the day currently being viewed ("Obroci
  // danas" for today).
  mealsHeading?: string;
  // "Deo 2": the adaptive daily-target plan for TODAY (computed server-side
  // from this week's logs). Only passed for the today view; when it signals an
  // adjustment, the ring targets the adapted number and a short note explains
  // why. Null/absent (past days, or a week that's on track) => the ring uses
  // the plain daily target, exactly as before.
  adaptivePlan?: AdaptivePlan | null;
  // First visit of the day (server-decided via the `fm_plan` cookie): play the
  // one-time "plan je prilagođen" reveal instead of rendering the calm card.
  planIntro?: boolean;
  // Voda + Koraci: the Belgrade day this screen shows + that day's already-
  // logged water (ml) and steps. When `dayKey` is provided the "Koraci" card
  // and "Voda" button render below the daily-intake block. Omitted in unit
  // tests that don't exercise them.
  dayKey?: string;
  initialWaterMl?: number;
  initialSteps?: number;
  // Recommended daily goals shown alongside the kcal target and used by the
  // steps/water cards. Steps defaults to the classic 10k; water is derived from
  // bodyweight (the same `waterGoalMl` the Analitika card uses).
  stepsGoal?: number;
  waterGoal?: number;
  // The 7 days ending on `dayKey`, each as a share of its goal — the strip at
  // the foot of the Koraci/Voda cards. Derived server-side by the SAME
  // `computeStepsWeek`/`computeWaterWeek` the Analitika cards use.
  stepsWeek?: MiniWeekDay[];
  waterWeek?: MiniWeekDay[];
  // Whether `dayKey` is the current Belgrade day. Gates "Gric", which always
  // writes at `now()` and so has no meaning on a past day.
  isToday?: boolean;
  // Nedeljno merenje (2026-08-01): days the app has been waiting for this
  // week's weigh-in, or null when it isn't waiting. Server-decided (the
  // schedule lives in `reminder_settings`), so this component only renders it.
  weighInDaysWaiting?: number | null;
}) {
  const { t } = useT();
  const [logs, setLogs] = useState<LogWithFood[]>(initialLogs);

  // Ring hand-off intro. Initial stage comes from the server prop so the SSR
  // markup already renders the cover (no flash of the assembled dashboard).
  const ringRef = useRef<HTMLDivElement>(null);
  const [introStage, setIntroStage] = useState<IntroStage>(
    intro ? "cover" : "idle"
  );
  const [ghostShift, setGhostShift] = useState(0);

  useIsomorphicLayoutEffect(() => {
    if (introStage !== "cover") return;

    // Consume the one-shot cookie so a later refresh of /danas won't replay.
    try {
      document.cookie = `${INTRO_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } catch {
      // no-op
    }

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No ring to hand off to (no target, or motion is not wanted): just show
    // the dashboard immediately.
    const rect = ringRef.current?.getBoundingClientRect();
    if (reduced || !target || !rect) {
      setIntroStage("done");
      return;
    }

    // Vertical delta from the viewport centre (where the ghost starts) to the
    // real daily ring's centre (where it should dock).
    setGhostShift(rect.top + rect.height / 2 - window.innerHeight / 2);

    const timers = [
      window.setTimeout(() => setIntroStage("glide"), 160),
      window.setTimeout(() => setIntroStage("land"), 160 + 680),
      window.setTimeout(() => setIntroStage("done"), 160 + 680 + 340),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
    // Runs exactly once on mount; `introStage` is only read for its initial
    // value and must not re-trigger this effect.
  }, []);

  const introActive =
    introStage === "cover" ||
    introStage === "glide" ||
    introStage === "land";

  // Keep the floating bottom nav (Početna/Analitika/Profil) hidden for the
  // whole onboarding ring hand-off. During "glide"/"land" the intro cover turns
  // transparent to reveal the dashboard, and the fixed nav (z-40) would
  // otherwise peek in underneath while the plan is still landing -- which reads
  // as "the questionnaire is showing the app tabs". We flag <html> for the
  // intro's duration; `intro-cover.css` hides the bar and fades it back in only
  // once the dashboard has fully landed ("done").
  useEffect(() => {
    if (!introActive) return;
    const root = document.documentElement;
    root.classList.add("intro-lock-nav");
    return () => root.classList.remove("intro-lock-nav");
  }, [introActive]);
  const dataIntro =
    introStage === "idle" || introStage === "done" ? undefined : introStage;

  function handleSaved(updatedLog: Log) {
    setLogs((previous) =>
      previous.map((log) =>
        log.id === updatedLog.id ? { ...log, ...updatedLog } : log
      )
    );
  }

  function handleDeleted(logId: string) {
    setLogs((previous) => previous.filter((log) => log.id !== logId));
  }

  const totals = useMemo(() => computeDayTotals(logs), [logs]);

  // The kcal number the whole block is measured against: the adapted target when
  // this week's overshoot has trimmed today, otherwise the plain daily one.
  const targetKcal =
    adaptivePlan?.isAdjusted
      ? adaptivePlan.adaptiveDailyTarget
      : (target?.daily_kcal ?? 0);

  // The step goal follows the SAME plan (2026-07-25). When food alone cannot
  // absorb an overshoot, the adaptive plan turns the remainder into movement --
  // and that has to be the number the "Koraci" card counts toward, otherwise the
  // app says "walk 50 minutes" in one place and "10.000 koraka" in another and
  // means one thing by both.
  const effectiveStepGoal = adaptivePlan?.isAdjusted
    ? adaptivePlan.adaptiveStepGoal
    : stepsGoal;

  // Second page (2026-07-25): fiber / sugar / sodium / saturated fat and the
  // health score. Both are pure functions of the SAME `logs` state the ring uses,
  // so an edit or delete updates all of it in one re-render, with no extra fetch
  // (the AS-043 "no full page reload" rule). Micros fall back to the referenced
  // food's per-100g values when a log's own snapshot is unknown -- see
  // `resolveLogMicros`.
  const micros = useMemo(() => computeMicroTotals(logs), [logs]);
  const microTargets = useMemo(
    () => microTargetsForKcal(targetKcal),
    [targetKcal]
  );
  const healthScore = useMemo(
    () =>
      computeHealthScore({
        consumedKcal: totals.kcal,
        consumedProteinG: totals.protein,
        micros,
        targetKcal,
        targetProteinG: target?.protein_g ?? 0,
        microTargets,
      }),
    [totals.kcal, totals.protein, micros, targetKcal, target?.protein_g, microTargets]
  );

  return (
    <main
      data-testid="home-screen"
      data-intro={dataIntro}
      className="home-main flex flex-1 flex-col gap-8 px-6 py-8"
    >
      {/* The brand lockup, streak pill and date wheel now live in the route's
          persistent `layout.tsx` (2026-07-30) so switching days never blanks
          them -- see that file. `HomeScreen` renders only the per-day content. */}

      {/* Nedeljno merenje: above everything, because it is a request rather
          than a report -- and gone the moment it is answered. Never on a past
          day: a weigh-in is a reading taken now. */}
      {isToday && weighInDaysWaiting !== null && !introActive ? (
        <WeighInBanner daysWaiting={weighInDaysWaiting} />
      ) : null}

      {target ? (
        <div className="flex flex-col gap-7">
          <h2
            className="home-body text-2xl font-bold tracking-tight text-foreground"
            style={{
              fontFamily: "var(--font-brand), var(--font-sans), sans-serif",
            }}
          >
            {t("home.dailyIntake")}
          </h2>
          {/* Three swipeable pages (2026-07-25), in the order the day is
              usually read: calories -> movement/hydration -> nutrient quality.
              Only this block moves; the heading above and the recommended-goals
              row below stay put. The pager's height follows the swipe, so a
              short page never leaves a gap above the dots.

              "Gric" deliberately stays on page ONE (the product owner's call):
              it is the fastest "I just ate something small" path on the screen,
              and it belongs next to the calorie ring it affects -- not behind a
              swipe. Koraci + Voda move to page two, where each card shows its
              goal and opens its own entry sheet. */}
          <IntakePager
            pages={[
              {
                id: "kalorije",
                labelSr: "Kalorije i makroi",
                content: (
                  // gap-4, not gap-7 (2026-07-25): this page is the tallest of
                  // the three and therefore sets the pager's height, so every
                  // pixel of air here is a pixel the OTHER two pages have to
                  // find something to do with.
                  <div className="flex flex-1 flex-col gap-4">
                    {/* "Slivanje" (2026-07-29): the calorie ring in its own
                        glass cloud, with the macro tiles below feeding coloured
                        threads that pour into the ring. `IntakeConfluence` owns
                        the view toggle + the ring/threads/tiles; it takes the
                        ring ref so the onboarding ghost hand-off still docks on
                        the ring (which fades in via its own `home-ring-slot`). */}
                    <IntakeConfluence
                      consumedKcal={totals.kcal}
                      targetKcal={targetKcal}
                      consumedMacros={{
                        protein: totals.protein,
                        carbs: totals.carbs,
                        fat: totals.fat,
                      }}
                      targetMacros={{
                        proteinG: target.protein_g,
                        carbsG: target.carbs_g,
                        fatG: target.fat_g,
                      }}
                      ringRef={ringRef}
                    />
                    {/* The plan card used to sit HERE, and that was the bug
                        (2026-08-01). Every pager page shares the tallest page's
                        height, so each line the card grew was a line of dead
                        space added to the Koraci/Voda and micronutrient pages --
                        the product owner reported them floating in a void. It
                        now renders BELOW the pager, where its height is its own
                        business. It also stops hiding behind a swipe: a notice
                        about today's plan should not require finding page one. */}
                    {/* Gric logs at `now()`, so it only makes sense on today. */}
                    {isToday ? (
                      <div className="home-body">
                        <GricButton />
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "nutrijenti",
                labelSr: "Vlakna, šećer, so i zasićene masti",
                content: (
                  // Centred, not `justify-between`: the cards keep their own
                  // size and any leftover height breathes above and below the
                  // pair — the same rule as the Koraci/Voda page, so no page
                  // ever pulls its contents apart to fill space.
                  <div className="home-body flex flex-1 flex-col justify-center gap-2.5">
                    <MicroCards micros={micros} targets={microTargets} />
                    <HealthScoreCard score={healthScore} />
                  </div>
                ),
              },
              // Koraci + Voda, LAST (2026-07-25, the product owner's order):
              // kalorije -> nutrijenti -> kretanje. Only when we know which day
              // we're on -- both write to that day's row.
              ...(dayKey
                ? [
                    {
                      id: "aktivnost",
                      labelSr: "Koraci i voda",
                      content: (
                        // Two self-sized cards, centred as a pair (2026-07-25).
                        // Neither the page nor the cards stretch: the pager's
                        // pages all share the tallest page's height, and every
                        // earlier attempt to swallow that slack -- spreading the
                        // blocks apart, then inflating the cards -- is what the
                        // product owner (rightly) called a mess. The leftover
                        // now breathes ABOVE and BELOW the pair, while the
                        // cards' own 7-day strips earn most of the height back.
                        <div className="home-body flex flex-1 flex-col justify-center gap-3">
                          <StepsCard
                            dayKey={dayKey}
                            initialSteps={initialSteps}
                            goal={effectiveStepGoal}
                            week={stepsWeek}
                          />
                          <WaterButton
                            dayKey={dayKey}
                            initialMl={initialWaterMl}
                            goalMl={waterGoal}
                            week={waterWeek}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {/* Below the pager, deliberately (2026-08-01): out here its height
              costs nothing but its own, so the three pages stay balanced no
              matter how much this card has to say.
              Shown for a moved plan OR a day whose log looked incomplete --
              both are things to act on today. NOT for `isOnTrackNotice`: "the
              week is fine" is a standing, not a task, and it now lives at the
              top of /analitika (`week-on-track-note.tsx`). Hence the explicit
              pair rather than `hasNotice`, which still includes it. */}
          {adaptivePlan &&
          (adaptivePlan.isAdjusted || adaptivePlan.untrustedDays.length > 0) ? (
            <AdaptivePlanCard
              plan={adaptivePlan}
              intro={planIntro}
              dayKey={dayKey}
            />
          ) : null}
        </div>
      ) : (
        <div
          data-testid="home-no-target"
          className="home-body rounded-2xl border border-dashed border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground"
        >
          {t("home.noTarget")}
        </div>
      )}

      {/* Koraci, Voda and Gric used to sit here as a fixed row; they now live
          inside the pager (Koraci/Voda on page two, Gric on page one). Kept out
          of the "no target set" branch above on purpose -- a user without a plan
          still sees the meal list below. */}
      {!target && dayKey ? (
        <div className="home-body flex flex-col gap-3">
          <StepsCard
            dayKey={dayKey}
            initialSteps={initialSteps}
            goal={stepsGoal}
          />
          <WaterButton
            dayKey={dayKey}
            initialMl={initialWaterMl}
            goalMl={waterGoal}
          />
          {isToday ? <GricButton /> : null}
        </div>
      ) : null}

      <section className="home-body flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {mealsHeading}
        </h2>
        <MealList logs={logs} onSaved={handleSaved} onDeleted={handleDeleted} />
      </section>

      {introActive ? (
        <IntroCover
          stage={introStage as "cover" | "glide" | "land"}
          shift={ghostShift}
          kcal={target?.daily_kcal ?? 0}
        />
      ) : null}

      {/* Post-onboarding install offer: mounts only after the ring hand-off
          has fully settled, so the two moments never fight for attention. */}
      {installPrompt && !introActive ? <InstallOverlay /> : null}
    </main>
  );
}
