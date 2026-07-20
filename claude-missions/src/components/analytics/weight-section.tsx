import { Card } from "@/components/ui/card";
import { WeighInSheet } from "@/components/analytics/weigh-in-sheet";
import { WeightTrendChart } from "@/components/analytics/weight-trend-chart";
import { formatTrendDayLabel, type WeightTrend } from "@/lib/weight/trend";

// F042/F043: the "Težina" section on `/analitika`. Presentational wrapper
// (the only interactive bit is the client `WeighInSheet` trigger): shows the
// latest weight big, a goal-progress hint, the trend chart, and the "Upiši
// težinu" entry. sr-Latn, informal "ti", zero-shame tone -- the message is
// always "the trend is what we track, not one scary day".
//
// Three display states, all keeping the card + entry button present:
//   * no weigh-ins  -> calm empty copy
//   * one weigh-in  -> the number + a "keep weighing" nudge (no line yet)
//   * many weigh-ins -> the number + goal hint + the trend chart

/** One decimal, Serbian formatting. */
function fmtKg(n: number): string {
  return n.toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** The goal-progress hint line, or null when there's no goal weight. */
function goalHint(trend: WeightTrend): string | null {
  if (trend.goalWeightKg == null || trend.deltaToGoalKg == null) return null;
  const abs = Math.abs(trend.deltaToGoalKg);
  // Within ±0.3 kg of goal counts as "there" -- weight noise is bigger than
  // that day to day, so celebrating the average landing on goal is fair.
  if (abs <= 0.3) return "Na cilju si — bravo!";
  return `Još ${fmtKg(abs)} kg do cilja`;
}

export function WeightSection({
  trend,
  profileWeightKg,
  now,
}: {
  trend: WeightTrend;
  /** Onboarding weight, used only to prefill the sheet when there are no
   * weigh-ins yet. */
  profileWeightKg?: number | null;
  now: Date;
}) {
  const hasData = trend.points.length > 0;
  const hasTrend = trend.points.length >= 2;
  const hint = goalHint(trend);
  const prefill = trend.latestWeightKg ?? profileWeightKg ?? null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Težina</h2>
        {hasData ? (
          <span className="text-xs text-muted-foreground">
            poslednjih 90 dana
          </span>
        ) : null}
      </div>

      <Card className="flex flex-col gap-4 p-5">
        {hasData ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {fmtKg(trend.latestWeightKg!)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    kg
                  </span>
                </span>
                {hint ? (
                  <span
                    data-testid="weight-goal-hint"
                    className="text-[11px] text-muted-foreground"
                  >
                    {hint}
                  </span>
                ) : null}
              </div>
              <WeighInSheet lastWeightKg={prefill} />
            </div>

            {hasTrend ? (
              <WeightTrendChart
                trend={trend}
                firstDayLabel={formatTrendDayLabel(trend.firstDay!, now)}
                lastDayLabel={formatTrendDayLabel(trend.lastDay!, now)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Meri se 2–3 puta nedeljno, najbolje ujutru u isto vreme, pa ćeš
                ovde videti trend.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Još nemaš nijedno merenje. Upiši prvu težinu — trend je ono što
              pratimo, ne pojedinačni dani.
            </p>
            <WeighInSheet lastWeightKg={prefill} />
          </div>
        )}
      </Card>
    </section>
  );
}
