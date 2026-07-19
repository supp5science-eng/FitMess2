"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AddSheet } from "@/components/home/add-sheet";
import { IntroCover } from "@/components/home/intro-cover";
import { MacroBars } from "@/components/home/macro-bars";
import { MealList } from "@/components/home/meal-list";
import { Ring } from "@/components/home/ring";
import type { LogWithFood } from "@/lib/home/attach-food";
import { computeDayTotals } from "@/lib/home/totals";
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
  name = null,
  intro = false,
}: {
  initialLogs: LogWithFood[];
  target: Target | null;
  // The signed-in user's name (`profiles.full_name`), used to personalize the
  // dashboard greeting. Null just falls back to a neutral header.
  name?: string | null;
  // Set by `/danas` (from the one-time `fm_intro` cookie) when the user has
  // just finished onboarding, so we play the ring hand-off exactly once.
  intro?: boolean;
}) {
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
      <header className="home-body">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {name ? `Zdravo, ${name}` : "Danas"}
        </h1>
      </header>

      {target ? (
        <div className="flex flex-col gap-8">
          {/* The ring lives in its own slot so the intro can fade just the
              ring in (where the ghost lands) after the body has risen in. */}
          <div ref={ringRef} className="home-ring-slot">
            <Ring consumedKcal={totals.kcal} targetKcal={target.daily_kcal} />
          </div>
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
            />
          </div>
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
          Obroci danas
        </h2>
        <MealList logs={logs} onSaved={handleSaved} onDeleted={handleDeleted} />
      </section>

      {/* F028 / AS-051: floating "+" -> bottom sheet with every logging
          method, at most 2 taps away from here. */}
      <AddSheet />

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
