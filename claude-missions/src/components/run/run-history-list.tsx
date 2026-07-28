import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { RunRouteThumb } from "@/components/run/run-route-thumb";
import { formatDuration, formatPace, paceSecPerKm } from "@/lib/run/pace";
import type { RunRoutePoint } from "@/lib/types/db";

export interface RunHistoryRow {
  id: string;
  started_at: string;
  distance_m: number;
  duration_s: number;
  calories: number;
  route: RunRoutePoint[];
}

/** A run's start instant as Belgrade-local "27. jul, 08:15". */
function shortStartedAt(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * The "Prethodna trčanja" list — each run as a row with its little route
 * thumbnail, distance + pace, and meta, linking to its summary. Presentational
 * (no data access); lives on `/analitika` now that `/trcanje` is the map.
 */
export function RunHistoryList({ runs }: { runs: RunHistoryRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        Prethodna trčanja
      </h2>
      {runs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Još nema trčanja. Otvori „Trčanje“ i tapni „Kreni“.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/trcanje/${run.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <RunRouteThumb route={run.route} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {(run.distance_m / 1000).toFixed(2)} km ·{" "}
                    {formatPace(paceSecPerKm(run.distance_m, run.duration_s))} /km
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {shortStartedAt(run.started_at)} ·{" "}
                    {formatDuration(run.duration_s)} · {run.calories} kcal
                  </span>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
