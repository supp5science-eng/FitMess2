import { ChevronRight, Footprints } from "lucide-react";
import Link from "next/link";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { belgradeWeekDayKeys } from "@/lib/dates";
import { summarizeRuns } from "@/lib/run/history";
import { formatDuration, formatPace, paceSecPerKm } from "@/lib/run/pace";
import { createClient } from "@/lib/supabase/server";

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
 * `/trcanje` — the Trčanje home (fourth tab). A prominent "Kreni" that opens the
 * recording screen, this week's tallies, and the recent-runs history. Server
 * Component: reads the caller's own `runs` (own-row RLS), tallies via the tested
 * `summarizeRuns`, and links each run to its summary.
 */
export default async function TrcanjePage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  const { data: runs } = userId
    ? await supabase
        .from("runs")
        .select("id, day, started_at, distance_m, duration_s, calories")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(30)
    : { data: null };

  const recent = runs ?? [];
  const week = summarizeRuns(recent, belgradeWeekDayKeys());

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Footprints className="size-5 text-primary" aria-hidden="true" />
          Trčanje
        </h1>
        <p className="text-sm text-muted-foreground">
          Snimi trčanje i vrati istrčane kalorije u svoj dnevni budžet.
        </p>
      </header>

      <Link
        href="/trcanje/snimanje"
        className="liquid-glass inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)]"
      >
        <Footprints className="size-6" aria-hidden="true" />
        Kreni
      </Link>

      {week.runCount > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <WeekStat value={(week.distanceM / 1000).toFixed(1)} label="km ove nedelje" />
          <WeekStat value={String(week.runCount)} label="trčanja" />
          <WeekStat value={String(week.calories)} label="kcal" />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Prethodna trčanja</h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Još nema trčanja. Tapni „Kreni“ i tvoja prva ruta pojaviće se
              ovde.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/trcanje/${run.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {(run.distance_m / 1000).toFixed(2)} km ·{" "}
                      {formatPace(paceSecPerKm(run.distance_m, run.duration_s))} /km
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {shortStartedAt(run.started_at)} · {formatDuration(run.duration_s)} ·{" "}
                      {run.calories} kcal
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
    </main>
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-4 text-center">
      <span className="text-xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
