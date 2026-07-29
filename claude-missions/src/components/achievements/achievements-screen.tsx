"use client";

import { ArrowLeft, Award, Flame } from "lucide-react";
import Link from "next/link";

import {
  AchievementTile,
  CATEGORY_STYLE,
} from "@/components/achievements/achievement-tile";
import type { CategoryGroup } from "@/lib/achievements/achievements";
import { useT } from "@/components/i18n/locale-provider";
import { dayCountSr } from "@/lib/streak/streak";

// Dostignuća — the full badges screen, opened by tapping the streak card on
// /danas. Flat, on-brand, zero-shame: two calm summary cards up top (the live
// streak + how many badges are in) and then every badge grouped by category,
// earned ones in colour, the rest greyed with a small lock. Presentational —
// the page derives every number with pure functions and hands it down.

export function AchievementsScreen({
  currentStreak,
  bestStreak,
  earned,
  total,
  groups,
}: {
  currentStreak: number;
  bestStreak: number;
  earned: number;
  total: number;
  groups: CategoryGroup[];
}) {
  const { t } = useT();
  const badgePct = total > 0 ? Math.round((earned / total) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/danas"
          aria-label={t("media.achievements.back")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted active:translate-y-px"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("media.achievements.title")}
        </h1>
      </header>

      {/* Two summary cards: the live streak + badge progress. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--streak-soft)" }}
            >
              <Flame
                className="size-4 text-[var(--streak-accent)]"
                strokeWidth={2.25}
              />
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {t("media.achievements.streak")}
            </span>
          </div>
          <span className="text-3xl font-bold leading-none tabular-nums text-foreground">
            {dayCountSr(currentStreak)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("media.achievements.longest", { count: dayCountSr(bestStreak) })}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full bg-primary/12 text-primary"
            >
              <Award className="size-4" strokeWidth={2.25} />
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {t("media.achievements.badges")}
            </span>
          </div>
          <span className="text-3xl font-bold leading-none tabular-nums text-foreground">
            {earned}
            <span className="text-lg font-semibold text-muted-foreground">
              /{total}
            </span>
          </span>
          <div
            className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={t("media.achievements.badgesEarnedAria", {
              earned,
              total,
            })}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${badgePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Every category, whether or not anything is earned in it yet. */}
      {groups.map((group) => {
        const { icon: Icon, accent, soft } = CATEGORY_STYLE[group.category];
        return (
          <section key={group.category} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-full"
                style={{ backgroundColor: soft, color: accent }}
              >
                <Icon className="size-[13px]" strokeWidth={2.5} />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                {group.label}
              </h2>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {group.earned}/{group.total}
              </span>
            </div>

            <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
              {group.achievements.map((achievement) => (
                <AchievementTile
                  key={achievement.id}
                  achievement={achievement}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}