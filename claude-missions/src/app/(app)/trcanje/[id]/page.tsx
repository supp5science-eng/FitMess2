import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RunMap } from "@/components/run/run-map";
import { RunSplits } from "@/components/run/run-splits";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  computeSplits,
  formatDuration,
  formatPace,
  paceSecPerKm,
} from "@/lib/run/pace";
import { createClient } from "@/lib/supabase/server";

/** A run's start instant as Belgrade-local "28. jul 2026, 08:15". */
function formatStartedAt(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * `/trcanje/[id]` — a finished run's summary: the whole route on the map, the
 * headline totals, and per-km splits. Zero-shame: it celebrates the distance,
 * never scolds. RLS scopes the read to the owner, so an unknown or someone
 * else's id is a plain 404.
 */
export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) notFound();

  const { data: run } = await supabase
    .from("runs")
    .select("id, started_at, duration_s, distance_m, calories, route")
    .eq("id", id)
    .maybeSingle();

  if (!run) notFound();

  const distanceKm = (run.distance_m / 1000).toFixed(2);
  const avgPace = paceSecPerKm(run.distance_m, run.duration_s);
  const splits = computeSplits(run.route);

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <Link
        href="/trcanje"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Trčanje
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bravo!{" "}
          <span className="text-[color:var(--brand)]">{distanceKm} km</span> 💪
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatStartedAt(run.started_at)}
        </p>
      </header>

      <RunMap points={run.route} className="aspect-[4/3] w-full" />

      <section className="grid grid-cols-2 gap-3">
        <BigStat label="Distanca" value={`${distanceKm} km`} />
        <BigStat label="Vreme" value={formatDuration(run.duration_s)} />
        <BigStat label="Prosečan tempo" value={`${formatPace(avgPace)} /km`} />
        <BigStat label="Kalorije" value={`${run.calories} kcal`} />
      </section>

      <RunSplits splits={splits} />
    </main>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-bold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
