import { ChevronRight, Footprints } from "lucide-react";
import Link from "next/link";

import { RunRouteThumb } from "@/components/run/run-route-thumb";
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
 * `/trcanje` — the Trčanje home (fourth tab). A teal "Kreni" hero that opens the
 * immersive recorder, this week's tallies, and the recent-runs history with a
 * little route thumbnail per run. Server Component: reads the caller's own
 * `runs` (own-row RLS), tallies via the tested `summarizeRuns`. On-brand teal
 * (via `--brand`, so it stays teal in light mode too), zero-shame.
 */
export default async function TrcanjePage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  const [{ data: weekRows }, { data: recentRows }] = userId
    ? await Promise.all([
        supabase
          .from("runs")
          .select("day, distance_m, calories")
          .eq("user_id", userId)
          .in("day", belgradeWeekDayKeys()),
        supabase
          .from("runs")
          .select("id, started_at, distance_m, duration_s, calories, route")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(12),
      ])
    : [{ data: null }, { data: null }];

  const week = summarizeRuns(weekRows ?? []);
  const recent = recentRows ?? [];

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Footprints className="size-6 text-[color:var(--brand)]" aria-hidden="true" />
          Trčanje
        </h1>
        <p className="text-sm text-muted-foreground">
          Snimi rutu i prati kilometražu, tempo i sagorele kalorije.
        </p>
      </header>

      {/* Teal hero — tap anywhere to start the immersive recorder. */}
      <Link
        href="/trcanje/snimanje"
        aria-label="Kreni u trčanje"
        className="relative block overflow-hidden rounded-3xl p-6 text-[#04231c] shadow-[0_14px_34px_-14px_rgba(23,209,168,0.75)]"
        style={{ backgroundImage: "linear-gradient(135deg,#2ee0bd,#0d9c7e)" }}
      >
        <svg
          viewBox="0 0 320 160"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
          aria-hidden="true"
        >
          <path
            d="M-10 120 C 60 60, 110 150, 170 90 S 280 30, 340 70"
            fill="none"
            stroke="#04231c"
            strokeWidth={6}
            strokeLinecap="round"
          />
        </svg>
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[#04231c]/70">
              Spreman?
            </span>
            <span className="text-2xl font-bold">Kreni u trčanje</span>
          </div>
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-[#04231c] text-white shadow-lg">
            <Footprints className="size-7" aria-hidden="true" />
          </span>
        </div>
      </Link>

      {week.runCount > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <WeekStat value={(week.distanceM / 1000).toFixed(1)} label="km ove nedelje" />
          <WeekStat value={String(week.runCount)} label="trčanja" />
          <WeekStat value={String(week.calories)} label="kcal" />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Prethodna trčanja
        </h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
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
    </main>
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card p-4 text-center">
      <span className="text-2xl font-bold tabular-nums text-[color:var(--brand)]">
        {value}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
