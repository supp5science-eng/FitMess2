"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DateStrip } from "@/components/home/date-strip";
import { IntroCover } from "@/components/home/intro-cover";
import { MacroBars } from "@/components/home/macro-bars";
import { MealList } from "@/components/home/meal-list";
import { Ring, type RingView } from "@/components/home/ring";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { DayCell } from "@/lib/home/date-strip";
import { computeDayTotals } from "@/lib/home/totals";
import type { Log, Target } from "@/lib/types/db";
import { cn } from "@/lib/utils";

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
  days = [],
  mealsHeading = "Obroci danas",
  adaptivePlan = null,
}: {
  initialLogs: LogWithFood[];
  target: Target | null;
  // Set by `/danas` (from the one-time `fm_intro` cookie) when the user has
  // just finished onboarding, so we play the ring hand-off exactly once.
  intro?: boolean;
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

  return (
    <main
      data-testid="home-screen"
      data-intro={dataIntro}
      className="home-main flex flex-1 flex-col gap-8 px-6 py-8"
    >
      <header className="home-body flex flex-col gap-5">
        {/* FitMess wordmark in the display face (Archivo Black); "Mess" in the
            brand teal (--brand) so the lockup keeps its identity in BOTH themes
            -- in light the accent `--primary` is black, which would flatten the
            wordmark, so we pin it to the theme-independent brand teal instead.
            No greeting, no mark -- just the brand lockup. */}
        <h1
          className="text-4xl tracking-tight text-foreground"
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          }}
        >
          Fit<span className="text-[color:var(--brand)]">Mess</span>
        </h1>
        {days.length > 0 ? <DateStrip days={days} /> : null}
      </header>

      {target ? (
        <div className="flex flex-col gap-7">
          <h2 className="home-body text-xl font-semibold tracking-tight text-foreground">
            Dnevni unos
          </h2>
          {/* The ring lives in its own slot so the intro can fade just the
              ring in (where the ghost lands) after the body has risen in. */}
          <div ref={ringRef} className="home-ring-slot">
            <Ring
              consumedKcal={totals.kcal}
              targetKcal={
                adaptivePlan?.isAdjusted
                  ? adaptivePlan.adaptiveDailyTarget
                  : target.daily_kcal
              }
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
        </div>
      ) : (
        <div
          data-testid="home-no-target"
          className="home-body rounded-2xl border border-dashed border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground"
        >
          Cilj još nije podešen, pa ne možemo da prikažemo tvoj dnevni budžet.
        </div>
      )}

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
    </main>
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
