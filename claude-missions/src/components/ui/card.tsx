import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The shared content-card surface. Extracts the `rounded-2xl border
 * border-border bg-card` pattern that was hand-duplicated across the weekly
 * dashboard, meal history, settings groups, meal cards, and the goal form.
 *
 * `bg-card` is the app's ONE content-card surface convention (the slightly
 * raised panel that sits on the `bg-muted`/`bg-background` page ground) --
 * adopting `Card` everywhere fixes the earlier drift where some cards used
 * `bg-background` (identical to the page in light, a different shade in dark)
 * and others `bg-card`, so cards no longer sit on mismatched surfaces.
 *
 * Deliberately minimal: no CVA, no padding of its own. Every caller adds its
 * own padding/layout via `className` (they already differ -- `p-4`, `p-5`,
 * `px-4 py-4`, column vs row), and can override the radius (e.g. the analytics
 * hero uses `rounded-3xl`) since `cn`/`twMerge` lets the last class win.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-2xl border border-border bg-card", className)}
      {...props}
    />
  );
}

export { Card };
