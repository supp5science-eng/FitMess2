import { Flame } from "lucide-react";
import Link from "next/link";

import { dayCountSr, type StreakSummary } from "@/lib/streak/streak";
import { cn } from "@/lib/utils";

// Niz, the compact way: a small flame + day count that lives in the /danas
// header next to the wordmark, so the streak is always visible without eating a
// whole card's worth of vertical space. Tapping it opens /dostignuca. The
// richer streak view (ring, week dots, record) lives on /analitika and the
// badges screen -- the home entry is deliberately just the number.
//
// Presentational: `current` arrives pre-derived from `computeStreak`. Warm
// (lit flame + soft tint) while a streak is running, calm grey at zero.

export function StreakPill({
  streak,
  href,
  className,
}: {
  streak: StreakSummary;
  /** When set, the pill is a link to this route (the /danas entry to
   * `/dostignuca`). */
  href?: string;
  className?: string;
}) {
  const active = streak.current > 0;

  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
    active ? "bg-[var(--streak-soft)]" : "bg-muted",
    className
  );

  const label = `Niz: ${dayCountSr(streak.current)}${
    href ? ". Otvori dostignuća." : ""
  }`;

  const content = (
    <>
      <Flame
        aria-hidden="true"
        strokeWidth={2.4}
        className={cn(
          "size-4 shrink-0",
          active ? "text-[var(--streak-accent)]" : "text-muted-foreground"
        )}
        style={
          active ? { filter: "drop-shadow(0 0 5px var(--streak-glow))" } : undefined
        }
      />
      <span
        data-testid="streak-pill-count"
        className={cn(
          "text-sm font-bold leading-none tabular-nums",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {streak.current}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-testid="streak-pill"
        aria-label={label}
        className={cn(
          base,
          "transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <span data-testid="streak-pill" aria-label={label} className={base}>
      {content}
    </span>
  );
}
