"use client";

import { useMemo, useState } from "react";

import { AddSheet } from "@/components/home/add-sheet";
import { MacroBars } from "@/components/home/macro-bars";
import { MealList } from "@/components/home/meal-list";
import { Ring } from "@/components/home/ring";
import type { LogWithFood } from "@/lib/home/attach-food";
import { computeDayTotals } from "@/lib/home/totals";
import type { Log, Target } from "@/lib/types/db";

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
}: {
  initialLogs: LogWithFood[];
  target: Target | null;
}) {
  const [logs, setLogs] = useState<LogWithFood[]>(initialLogs);

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
      className="flex flex-1 flex-col gap-8 px-6 py-8"
    >
      <h1 className="sr-only">Danas</h1>

      {target ? (
        <div className="flex flex-col gap-8">
          <Ring consumedKcal={totals.kcal} targetKcal={target.daily_kcal} />
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
      ) : (
        <div
          data-testid="home-no-target"
          className="rounded-2xl border border-dashed border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground"
        >
          Cilj još nije podešen, pa ne možemo da prikažemo tvoj dnevni budžet.
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Obroci danas
        </h2>
        <MealList logs={logs} onSaved={handleSaved} onDeleted={handleDeleted} />
      </section>

      {/* F028 / AS-051: floating "+" -> bottom sheet with every logging
          method, at most 2 taps away from here. */}
      <AddSheet />
    </main>
  );
}
