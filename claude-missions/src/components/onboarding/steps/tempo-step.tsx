"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_PACE,
  PACE_DESCRIPTIONS,
  PACE_LABELS,
  PACE_ORDER,
  PACE_WEEKLY_KG,
  formatTimeToGoal,
  timeframeWeeksForPace,
  type WeightChangePace,
} from "@/lib/onboarding/pace";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";

/** Emoji marker per pace (sloth → rabbit → cheetah). */
const PACE_ICON: Record<WeightChangePace, string> = {
  slow: "🦥",
  recommended: "🐇",
  fast: "🐆",
};

/** Accent color per pace — amber (gentle), green (the recommended sweet spot),
 * red (aggressive). Used only on the selected card so the choice reads at a
 * glance. */
const PACE_ACCENT: Record<WeightChangePace, string> = {
  slow: "#C79328",
  recommended: "#16A34A",
  fast: "#E1493F",
};

/** One-line tagline per pace, shown on its card. */
const PACE_TAGLINE: Record<WeightChangePace, string> = {
  slow: "Najlakše se održava",
  recommended: "Idealno za većinu",
  fast: "Najbrži rezultat",
};

function kgReadout(kg: number): string {
  return kg.toLocaleString("sr-RS", { maximumFractionDigits: 2 });
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="11" fill={color} />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The `tempo` step — the questionnaire's last question for weight-change
 * goals: "how fast do you want to reach your goal?" Three selectable cards
 * (slow / recommended / fast) instead of a slider. Each card shows its weekly
 * rate and the resulting timeframe; the recommended one is badged. From the
 * chosen pace we DERIVE the timeframe in weeks (pushed up via
 * `onChangeTimeframe`, so the budget engine + DB consume it unchanged) and
 * show a live daily-calorie preview below.
 */
export function TempoStep({
  data,
  onChangePace,
  onChangeTimeframe,
}: {
  data: OnboardingData;
  onChangePace: (pace: WeightChangePace) => void;
  onChangeTimeframe: (weeks: number | null) => void;
}) {
  const pace: WeightChangePace = data.pace ?? DEFAULT_PACE;

  const deltaKg =
    data.weightKg !== null &&
    data.targetWeightKg !== null &&
    !Number.isNaN(data.weightKg) &&
    !Number.isNaN(data.targetWeightKg)
      ? Math.abs(data.weightKg - data.targetWeightKg)
      : null;

  const timeframeWeeks =
    deltaKg !== null ? timeframeWeeksForPace(deltaKg, pace) : null;

  // Keep the derived timeframe in the collected data so everything downstream
  // (completion check, budget engine, persist → `targets.timeframe_weeks`)
  // sees the chosen pace's effect.
  useEffect(() => {
    if (timeframeWeeks !== null && timeframeWeeks !== data.timeframeWeeks) {
      onChangeTimeframe(timeframeWeeks);
    }
  }, [timeframeWeeks, data.timeframeWeeks, onChangeTimeframe]);

  // Live daily-calorie target for the selected pace, through the same engine
  // the plan reveal uses. Pure arithmetic, so no memoization needed.
  const dailyKcal = ((): number | null => {
    if (
      timeframeWeeks === null ||
      data.sex === null ||
      data.ageYears === null ||
      data.heightCm === null ||
      data.weightKg === null ||
      data.activityLevel === null ||
      data.goal === null ||
      data.targetWeightKg === null
    ) {
      return null;
    }
    return computeBudgetSummary({
      name: data.name,
      sex: data.sex,
      ageYears: data.ageYears,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      activityLevel: data.activityLevel,
      goal: data.goal,
      targetWeightKg: data.targetWeightKg,
      pace,
      timeframeWeeks,
    }).dailyKcal;
  })();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koliko brzo želiš da stigneš do cilja?
        </h2>
        <p className="text-sm text-muted-foreground">
          Izaberi tempo — od njega zavisi tvoj dnevni unos kalorija.
        </p>
      </div>

      {/* Pace cards */}
      <div role="radiogroup" aria-label="Tempo dostizanja cilja" className="flex flex-col gap-3">
        {PACE_ORDER.map((p) => {
          const selected = p === pace;
          const accent = PACE_ACCENT[p];
          const weeks =
            deltaKg !== null ? timeframeWeeksForPace(deltaKg, p) : null;
          const isRec = p === "recommended";
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={PACE_LABELS[p]}
              onClick={() => onChangePace(p)}
              className={cn(
                "relative flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                selected ? "shadow-sm" : "border-border bg-card hover:border-foreground/20"
              )}
              style={
                selected
                  ? {
                      borderColor: accent,
                      background: `color-mix(in srgb, ${accent} 8%, var(--card))`,
                    }
                  : undefined
              }
            >
              {/* Icon tile */}
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl text-2xl transition-colors"
                style={{
                  background: selected
                    ? `color-mix(in srgb, ${accent} 16%, transparent)`
                    : "var(--muted)",
                }}
                aria-hidden
              >
                {PACE_ICON[p]}
              </span>

              {/* Text */}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <b className="text-[15px] font-bold text-foreground">
                    {PACE_LABELS[p]}
                  </b>
                  {isRec ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ background: accent }}
                    >
                      Preporučeno
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 text-[13px] text-muted-foreground">
                  {kgReadout(PACE_WEEKLY_KG[p])} kg nedeljno
                  {weeks !== null ? ` · za ~${formatTimeToGoal(weeks)}` : ""}
                </span>
                <span className="text-[12px] text-muted-foreground/80">
                  {PACE_TAGLINE[p]}
                </span>
              </span>

              {/* Selected check */}
              <span className="shrink-0">
                {selected ? (
                  <span className="onb-pop block">
                    <CheckIcon color={accent} />
                  </span>
                ) : (
                  <span className="block size-6 rounded-full border-2 border-border" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live daily-calorie summary for the selected pace */}
      {dailyKcal !== null ? (
        <div className="rounded-2xl bg-muted/60 px-4 py-3 text-center">
          <span className="text-sm text-muted-foreground">Tvoj dnevni cilj</span>
          <div
            className="text-2xl font-bold"
            data-testid="tempo-daily-kcal"
            style={{ color: PACE_ACCENT[pace] }}
          >
            {dailyKcal.toLocaleString("sr-RS")} kcal
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {PACE_DESCRIPTIONS[pace]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
