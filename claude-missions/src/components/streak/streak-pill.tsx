"use client";

import { Flame } from "lucide-react";
import Link from "next/link";

import { useT } from "@/components/i18n/locale-provider";
import { dayCountSr, type StreakSummary } from "@/lib/streak/streak";
import { cn } from "@/lib/utils";

// Niz, the compact way: a small flame + day count that lives in the /danas
// header next to the wordmark, so the streak is always visible without eating a
// whole card's worth of vertical space. Tapping it opens /dostignuca. The
// richer streak view (ring, week dots, record) lives on /analitika and the
// badges screen -- the home entry is deliberately just the number.
//
// Presentational: `current` arrives pre-derived from `computeStreak`. Warm
// (lit flame + soft tint inside an amber hairline) while a streak is running,
// calm and edgeless at zero.

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
  const { t } = useT();
  const active = streak.current > 0;

  // A hairline of the accent, not just the soft fill. On the pale paper a
  // low-alpha tint alone has almost nothing to sit against, so the pill lost
  // its edge and read as a smudge rather than a chip; the rule gives it a shape
  // and lets the fill stay light enough to never look stained. Only the lit
  // state gets it -- at zero the pill is deliberately quiet.
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
    active
      ? "border-[color-mix(in_srgb,var(--streak-accent)_28%,transparent)] bg-[var(--streak-soft)]"
      : "border-transparent bg-muted",
    className
  );

  const label = `${t("media.streakPill.label", {
    count: dayCountSr(streak.current),
  })}${href ? t("media.streakPill.openAchievements") : ""}`;

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
