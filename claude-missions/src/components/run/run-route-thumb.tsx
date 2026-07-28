import { Footprints } from "lucide-react";

import { routeThumbPoints } from "@/lib/run/route-thumb";
import type { RunRoutePoint } from "@/lib/types/db";
import { cn } from "@/lib/utils";

/**
 * A tiny teal line-drawing of a run's route for the history rows — a
 * hand-rolled SVG (no map tile to load per row), on the FitMess brand teal so
 * it reads in both themes. Falls back to a footprints glyph when the route is
 * too short to draw.
 */
export function RunRouteThumb({
  route,
  className,
}: {
  route: readonly RunRoutePoint[];
  className?: string;
}) {
  const points = routeThumbPoints(route);

  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40",
        className
      )}
    >
      {points ? (
        <svg
          viewBox="0 0 64 40"
          className="h-7 w-11"
          fill="none"
          aria-hidden="true"
        >
          <polyline
            points={points}
            stroke="var(--brand)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <Footprints
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
