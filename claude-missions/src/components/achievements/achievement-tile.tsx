"use client";

import {
  CircleCheckBig,
  Droplet,
  Flame,
  Footprints,
  Lock,
  Target,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type {
  Achievement,
  AchievementCategory,
} from "@/lib/achievements/achievements";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

// One badge in the Dostignuća grid. Flat and light (the product owner's brief:
// "ravno i lagano, u duhu app-a" -- no heavy 3D medals): a rounded emblem in
// the category's accent when earned, a calm grey with a little lock when not.
// Purely presentational -- earned/progress arrive pre-derived from
// `evaluateAchievements`.

/** Per-category icon + accent. Accents reuse the app's existing feature
 * colours so the grid reads as the same world: flame (niz), teal brand
 * (obroci), green (puni dani), gold (kalorije), sky (voda), violet (koraci).
 * All hold their contrast in BOTH themes (themed tokens or theme-independent
 * hues). */
export const CATEGORY_STYLE: Record<
  AchievementCategory,
  { icon: LucideIcon; accent: string; soft: string }
> = {
  niz: {
    icon: Flame,
    accent: "var(--streak-accent)",
    soft: "var(--streak-soft)",
  },
  punDan: {
    icon: CircleCheckBig,
    accent: "var(--macro-carbs)",
    soft: "color-mix(in srgb, var(--macro-carbs) 15%, transparent)",
  },
  obroci: {
    icon: UtensilsCrossed,
    accent: "var(--brand)",
    soft: "color-mix(in srgb, var(--brand) 15%, transparent)",
  },
  kalorije: {
    icon: Target,
    accent: "var(--chart-5)",
    soft: "color-mix(in srgb, var(--chart-5) 16%, transparent)",
  },
  voda: {
    icon: Droplet,
    accent: "#38bdf8",
    soft: "rgba(56, 189, 248, 0.15)",
  },
  koraci: {
    icon: Footprints,
    accent: "#8b5cf6",
    soft: "rgba(139, 92, 246, 0.15)",
  },
};

export function AchievementTile({
  achievement,
}: {
  achievement: Achievement;
}) {
  const { t } = useT();
  const { icon: Icon, accent, soft } = CATEGORY_STYLE[achievement.category];
  const { earned, title, criteria, value, threshold } = achievement;

  return (
    <li
      className="flex flex-col items-center gap-2 text-center"
      aria-label={
        earned
          ? t("media.achievement.earnedAria", { title, criteria })
          : t("media.achievement.lockedAria", { title, value, threshold })
      }
    >
      <div
        className={cn(
          "relative flex size-[66px] flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors",
          !earned && "bg-muted"
        )}
        style={
          earned
            ? {
                backgroundColor: soft,
                color: accent,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
              }
            : undefined
        }
      >
        <Icon
          aria-hidden="true"
          strokeWidth={2.25}
          className={cn("size-[18px]", !earned && "text-muted-foreground/45")}
        />
        <span
          className={cn(
            "text-[15px] font-bold leading-none tabular-nums",
            !earned && "text-muted-foreground/50"
          )}
        >
          {threshold}
        </span>

        {!earned ? (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground/60"
          >
            <Lock className="size-2.5" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <p
          className={cn(
            "text-[13px] font-semibold leading-tight",
            earned ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {title}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground tabular-nums">
          {earned ? criteria : `${value} / ${threshold}`}
        </p>
      </div>
    </li>
  );
}