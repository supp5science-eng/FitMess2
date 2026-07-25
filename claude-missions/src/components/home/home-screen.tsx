"use client";

import { Droplet, Flame, Footprints } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DateStrip } from "@/components/home/date-strip";
import { HealthScoreCard } from "@/components/home/health-score-card";
import { IntakePager } from "@/components/home/intake-pager";
import { IntroCover } from "@/components/home/intro-cover";
import { InstallOverlay } from "@/components/pwa/install-overlay";
import { MacroBars } from "@/components/home/macro-bars";
import { MicroCards } from "@/components/home/micro-cards";
import { MealList } from "@/components/home/meal-list";
import { Ring, type RingView } from "@/components/home/ring";
import { StepsCard } from "@/components/home/steps-card";
import { GricButton } from "@/components/home/gric-button";
import { WaterButton } from "@/components/home/water-button";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { DayCell } from "@/lib/home/date-strip";
import { computeDayTotals } from "@/lib/home/totals";
import { computeHealthScore } from "@/lib/nutrition/health-score";
import { computeMicroTotals, microTargetsForKcal } from "@/lib/nutrition/micro";
import { DEFAULT_STEP_GOAL } from "@/lib/steps/steps-week";
import { formatWaterSr, waterGoalMl } from "@/lib/water/water-week";
import type { Log, Target } from "@/lib/types/db";
import { cn } from "@/lib/utils";

/** `10000` -> `"10.000"` (Serbian thousands separator). */
function formatSteps(steps: number): string {
  return String(steps).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

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
  days = [],
  mealsHeading = "Obroci danas",
  adaptivePlan = null,
  dayKey,
  initialWaterMl = 0,
  initialSteps = 0,
  stepsGoal = DEFAULT_STEP_GOAL,
  waterGoal = waterGoalMl(null),
  isToday = true,
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
  // The date strip's day cells (built server-side) + the meals-section heading
  // for the day currently being viewed ("Obroci danas" for today).
  days?: DayCell[];
  mealsHeading?: string;
  // "Deo 2": the adaptive daily-target plan for TODAY (computed server-side
  // from this week's logs). Only passed for the today view; when it signals an
  // adjustment, the ring targets the adapted number and a short note explains
  // why. Null/absent (past days, or a week that's on track) => the ring uses
  // the plain daily target, exactly as before.
  adaptivePlan?: AdaptivePlan | null;
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
  // Whether `dayKey` is the current Belgrade day. Gates "Gric", which always
  // writes at `now()` and so has no meaning on a past day.
  isToday?: boolean;
}) {
  const [logs, setLogs] = useState<LogWithFood[]>(initialLogs);

  // Calorie/macro display mode. Defaults to "remaining" (Preostalo) -- what
  // the user has left today -- with "consumed" (Potrošeno) as the alternate.
  const [view, setView] = useState<RingView>("remaining");

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
      <header className="home-body flex flex-col gap-5">
        {/* Brand lockup: the sedef (paua-shell) pear mark + the FitMess
            wordmark in the display face (Archivo Black). "Mess" is painted with
            the logo's own iridescent gradient (`.fm-wordmark-accent`, defined in
            globals.css, theme-aware) so the word literally wears the pear's
            colours; the mark is decorative (`aria-hidden`) since the <h1> text
            already names the app. */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/fitmess-icon.png"
            alt=""
            width={36}
            height={36}
            aria-hidden="true"
            className="size-9 shrink-0 select-none"
          />
          <h1
            className="text-4xl tracking-tight text-foreground"
            style={{
              fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            }}
          >
            Fit<span className="fm-wordmark-accent">Mess</span>
          </h1>
        </div>
        {days.length > 0 ? <DateStrip days={days} /> : null}
      </header>

      {target ? (
        <div className="flex flex-col gap-7">
          <h2 className="home-body text-xl font-semibold tracking-tight text-foreground">
            Dnevni unos
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
                  <div className="flex flex-col gap-7">
                    {/* The ring lives in its own slot so the intro can fade
                        just the ring in (where the ghost lands) after the body
                        has risen in. */}
                    <div ref={ringRef} className="home-ring-slot">
                      <Ring
                        consumedKcal={totals.kcal}
                        targetKcal={targetKcal}
                        view={view}
                      />
                    </div>
                    {adaptivePlan?.isAdjusted ? (
                      <AdaptiveNote plan={adaptivePlan} />
                    ) : null}
                    <div className="home-body">
                      <MacroBars
                        consumed={{
                          protein: totals.protein,
                          carbs: totals.carbs,
                          fat: totals.fat,
                        }}
                        target={{
                          proteinG: target.protein_g,
                          carbsG: target.carbs_g,
                          fatG: target.fat_g,
                        }}
                        view={view}
                      />
                    </div>
                    <ViewToggle view={view} onChange={setView} />
                    {/* Gric logs at `now()`, so it only makes sense on today. */}
                    {isToday ? (
                      <div className="home-body">
                        <GricButton />
                      </div>
                    ) : null}
                  </div>
                ),
              },
              // Koraci + Voda. Only when we know which day we're on -- both
              // write to that day's row, same guard as before the move.
              ...(dayKey
                ? [
                    {
                      id: "aktivnost",
                      labelSr: "Koraci i voda",
                      content: (
                        <div className="home-body flex flex-col gap-2.5">
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
                        </div>
                      ),
                    },
                  ]
                : []),
              {
                id: "nutrijenti",
                labelSr: "Vlakna, šećer, so i zasićene masti",
                content: (
                  <div className="home-body flex flex-col gap-2.5">
                    <MicroCards micros={micros} targets={microTargets} />
                    <HealthScoreCard score={healthScore} />
                  </div>
                ),
              },
            ]}
          />
          <DailyTargets
            kcal={targetKcal}
            stepsGoal={stepsGoal}
            waterGoalMl={waterGoal}
          />
        </div>
      ) : (
        <div
          data-testid="home-no-target"
          className="home-body rounded-2xl border border-dashed border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground"
        >
          Cilj još nije podešen, pa ne možemo da prikažemo tvoj dnevni budžet.
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

/**
 * "Preporučeni dnevni ciljevi": the day's recommended targets shown together
 * with the calorie result — kcal (the ring's number), a step goal, and a water
 * goal — so the three read as one plan. Steps use the classic 10k; water is
 * derived from bodyweight (the SAME `waterGoalMl` the Analitika card uses), so
 * the home recommendation and the analytics goal always agree.
 */
function DailyTargets({
  kcal,
  stepsGoal,
  waterGoalMl,
}: {
  kcal: number;
  stepsGoal: number;
  waterGoalMl: number;
}) {
  return (
    <div className="home-body flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Preporučeni dnevni ciljevi
      </h3>
      <div data-testid="daily-targets" className="grid grid-cols-3 gap-2.5">
        <TargetTile
          icon={<Flame className="size-4" aria-hidden="true" />}
          tone="text-amber-500"
          chip="bg-amber-500/15"
          label="Kalorije"
          value={`${kcal}`}
        />
        <TargetTile
          icon={<Footprints className="size-4" aria-hidden="true" />}
          tone="text-violet-500"
          chip="bg-violet-500/15"
          label="Koraci"
          value={formatSteps(stepsGoal)}
        />
        <TargetTile
          icon={<Droplet className="size-4" aria-hidden="true" />}
          tone="text-sky-400"
          chip="bg-sky-500/15"
          label="Voda"
          value={formatWaterSr(waterGoalMl)}
        />
      </div>
    </div>
  );
}

function TargetTile({
  icon,
  tone,
  chip,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  chip: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-3 text-center">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          chip,
          tone
        )}
      >
        {icon}
      </span>
      <span className="text-[0.7rem] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * "Deo 2": a short, calm note shown on today's dashboard when the week's
 * earlier overshoot has trimmed today's target. Explains the adjusted number
 * (so the ring's smaller "Cilj" isn't a mystery) and, when food alone can't
 * absorb the overshoot without dropping below the safe floor, suggests a bit
 * of activity to cover the rest.
 */
function AdaptiveNote({ plan }: { plan: AdaptivePlan }) {
  return (
    <div
      data-testid="adaptive-note"
      className="home-body rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm"
    >
      <p className="font-semibold text-foreground">Prilagođeno ove nedelje</p>
      <p className="mt-0.5 text-muted-foreground">
        Zbog ranijeg prekoračenja, današnji cilj je snižen na{" "}
        <span data-testid="adaptive-note-target" className="font-medium text-foreground">
          {plan.adaptiveDailyTarget} kcal
        </span>{" "}
        (redovni: {plan.baseDailyTarget}) — da se nedelja vrati na prag.
      </p>
      {plan.trainingSuggestionKcal > 0 ? (
        <p
          data-testid="adaptive-note-training"
          className="mt-1.5 text-muted-foreground"
        >
          Preostalo pokrij aktivnošću:{" "}
          <span className="font-medium text-foreground">
            ~{plan.trainingSuggestionKcal} kcal
          </span>{" "}
          danas (≈ {plan.trainingWalkMinutes} min brzog hoda).
        </p>
      ) : null}
    </div>
  );
}

/**
 * The "Potrošeno | Preostalo" segmented toggle that drives the gauge + macros
 * display mode. Two real buttons in a pill; the selected one is a light,
 * high-contrast fill (like the reference design). "Preostalo" is the default.
 */
function ViewToggle({
  view,
  onChange,
}: {
  view: RingView;
  onChange: (next: RingView) => void;
}) {
  const options: { value: RingView; label: string }[] = [
    { value: "consumed", label: "Potrošeno" },
    { value: "remaining", label: "Preostalo" },
  ];

  return (
    <div
      role="group"
      aria-label="Prikaz kalorija i makroa"
      className="home-body mx-auto inline-flex items-center gap-1 rounded-full bg-muted p-1"
    >
      {options.map(({ value, label }) => {
        const selected = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={cn(
              "min-h-11 rounded-full px-6 text-sm font-semibold transition-colors",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
