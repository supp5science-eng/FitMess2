"use client";

import { useT } from "@/components/i18n/locale-provider";
import type { HealthScore } from "@/lib/nutrition/health-score";

// "Ocena zdravosti" (2026-07-25): the card under the four micronutrient cards on
// the home tab's second page. Presentational -- the 0..10 number, its band label
// and its one-line note all come from `computeHealthScore`
// (`src/lib/nutrition/health-score.ts`), which explains how the score is built.
//
// `null` score renders as "N/A" with the reason underneath (not enough logged,
// or too little known about what was logged) rather than a made-up number.

/** `7.4` -> `"7,4"` -- Serbian decimal comma, and a whole score loses the ",0". */
function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

export function HealthScoreCard({ score }: { score: HealthScore }) {
  const { t } = useT();
  const hasScore = score.score !== null;

  return (
    <div
      data-testid="health-score-card"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {t("home.health.title")}
        </h3>
        <span
          data-testid="health-score-value"
          className="text-xl font-bold tabular-nums text-foreground"
        >
          {hasScore ? (
            <>
              {formatScore(score.score as number)}
              <span className="text-sm font-medium text-muted-foreground">
                {" "}
                / 10
              </span>
            </>
          ) : (
            "N/A"
          )}
        </span>
      </div>

      {/* The bar doubles as the "no score yet" state: an empty track. */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={
          hasScore
            ? t("home.health.ariaScore", {
                score: formatScore(score.score as number),
              })
            : t("home.health.ariaUnavailable")
        }
      >
        <div
          data-testid="health-score-bar"
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.round(score.fillFraction * 100)}%`,
            // Low scores lean amber, good scores go to the brand gauge gradient
            // -- the same teal/azure family as the calorie ring, so a strong day
            // visually rhymes with a filled ring.
            backgroundImage:
              score.fillFraction >= 0.55
                ? "linear-gradient(90deg, var(--gauge-grad-1), var(--gauge-grad-3))"
                : "linear-gradient(90deg, #fbbf24, #f59e0b)",
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {score.labelSr ? (
          <span
            data-testid="health-score-label"
            className="text-sm font-semibold text-foreground"
          >
            {score.labelSr}
          </span>
        ) : null}
        <p className="text-xs leading-snug text-muted-foreground">
          {score.noteSr}
        </p>
      </div>
    </div>
  );
}
