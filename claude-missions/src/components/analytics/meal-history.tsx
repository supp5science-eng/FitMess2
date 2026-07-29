"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { MealHistoryRow } from "@/components/analytics/meal-history-row";
import { useT } from "@/components/i18n/locale-provider";
import type { DayGroup } from "@/lib/log/group";

// F041 "Svi obroci" section at the bottom of `/analitika`: a collapsible
// meal-history log. Opens on the last 7 days of meals grouped by day; a
// "Prikaži više" button reveals the rest of the 30-day window (older meals
// are pruned server-side, so 30 days is the full history). sr-Latn, "ti",
// zero-shame. Client component: just two bits of disclosure state, no data
// fetching (the page passes already-grouped, server-fetched rows).

function DayBlock({ group }: { group: DayGroup }) {
  return (
    <div data-testid={`meal-history-day-${group.dayKey}`}>
      <div className="flex items-baseline justify-between border-b border-border/60 pb-1.5 pt-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {group.totalKcal.toLocaleString("sr-RS")} kcal
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        {group.logs.map((log) => (
          <MealHistoryRow key={log.id} log={log} />
        ))}
      </ul>
    </div>
  );
}

export function MealHistory({
  recentGroups,
  olderGroups,
}: {
  recentGroups: DayGroup[];
  olderGroups: DayGroup[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const [showOlder, setShowOlder] = useState(false);

  const isEmpty = recentGroups.length === 0 && olderGroups.length === 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between gap-2 text-left"
      >
        <span className="text-base font-semibold text-foreground">
          {t("analytics.mealHistory.title")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        isEmpty ? (
          <p
            data-testid="meal-history-empty"
            className="py-4 text-sm text-muted-foreground"
          >
            {t("analytics.mealHistory.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {recentGroups.map((group) => (
              <DayBlock key={group.dayKey} group={group} />
            ))}

            {olderGroups.length > 0 && !showOlder ? (
              <button
                type="button"
                data-testid="meal-history-show-more"
                onClick={() => setShowOlder(true)}
                className="mt-1 inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground active:bg-muted"
              >
                {t("analytics.mealHistory.showMore")}
              </button>
            ) : null}

            {showOlder
              ? olderGroups.map((group) => (
                  <DayBlock key={group.dayKey} group={group} />
                ))
              : null}
          </div>
        )
      ) : null}
    </section>
  );
}
