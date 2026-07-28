import { formatPace } from "@/lib/run/pace";
import type { Split } from "@/lib/run/pace";

/**
 * Per-kilometre splits as a calm, hand-rolled bar chart (no charting library —
 * same posture as the rest of FitMess's charts). Each bar's length is the km's
 * pace relative to the slowest split, so the eye reads "which km was hardest"
 * without any punitive colour. The trailing partial km is labelled by distance.
 */
export function RunSplits({ splits }: { splits: Split[] }) {
  if (splits.length === 0) return null;

  const slowest = Math.max(...splits.map((s) => s.paceSecPerKm), 1);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">Deonice po kilometru</h2>
      <ul className="flex flex-col gap-1.5">
        {splits.map((split) => {
          const label = split.partial
            ? (split.distanceM / 1000).toFixed(2)
            : String(split.km);
          const widthPct = Math.max(8, (split.paceSecPerKm / slowest) * 100);
          return (
            <li key={split.km} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {label}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-primary/70"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-sm tabular-nums text-foreground">
                {formatPace(split.paceSecPerKm)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
