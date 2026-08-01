"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Footprints,
  Info,
  Minus,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MessageKey } from "@/lib/i18n/messages";
import type { WeeklyTrendResult } from "@/lib/weight/weekly-trend";

/**
 * Nedeljno merenje: what the scale said, and the one decision it asks for.
 *
 * Three things, in the order a person actually wants them:
 *
 *   1. the trend, next to the pace the goal expects -- a number is only
 *      information once you know what it was supposed to be;
 *   2. the measurement that contradicts (or confirms) the plan's prediction;
 *   3. the decision, as two buttons, never as a change that already happened.
 *
 * The prose paragraph is written by Gemini from the numbers this card already
 * has -- but it starts as a locally-built template sentence and is only
 * REPLACED if the AI answers. That ordering is the whole fallback strategy:
 * there is no spinner, no empty state and no failure path, because the page is
 * complete before the request is made.
 */

const STATUS_LABEL: Record<WeeklyTrendResult["status"], MessageKey> = {
  ON_TRACK: "merenje.status.onTrack",
  TOO_SLOW: "merenje.status.tooSlow",
  STALLED: "merenje.status.stalled",
  TOO_FAST: "merenje.status.tooFast",
  INSUFFICIENT_DATA: "merenje.status.unknown",
};

const STATUS_EXPLAIN: Record<
  Exclude<WeeklyTrendResult["status"], "INSUFFICIENT_DATA">,
  MessageKey
> = {
  ON_TRACK: "merenje.explain.onTrack",
  TOO_SLOW: "merenje.explain.tooSlow",
  STALLED: "merenje.explain.stalled",
  TOO_FAST: "merenje.explain.tooFast",
};

const REASON_EXPLAIN: Record<
  NonNullable<WeeklyTrendResult["reason"]>,
  MessageKey
> = {
  few_weigh_ins: "merenje.explain.fewWeighIns",
  span_too_short: "merenje.explain.spanTooShort",
  untrusted_intake: "merenje.explain.untrustedIntake",
  implausible_measurement: "merenje.explain.implausibleMeasurement",
};

function formatKg(kg: number): string {
  const sign = kg > 0 ? "+" : kg < 0 ? "−" : "";
  return `${sign}${Math.abs(kg).toLocaleString("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString("sr-RS");
}

/**
 * The app admitting the limits of what it knows.
 *
 * Set apart from the body copy on purpose. "One weigh-in means nothing" and
 * "your weight is moving slower than planned" are not the same kind of
 * statement -- one is a reading of the data, the other is a caveat about
 * whether there IS any -- and rendering them as identical grey paragraphs let
 * a caveat be skimmed as a verdict. Boxed, marked and quieter, so it reads as
 * the footnote it is.
 */
function Disclaimer({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <p
      data-testid={testId}
      className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground"
    >
      <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden={true} />
      <span>{children}</span>
    </p>
  );
}

export function WeeklyResultCard({
  trend,
  currentDailyKcal,
  silenced,
}: {
  trend: WeeklyTrendResult;
  currentDailyKcal: number;
  /** The user recently said "keep my plan" -- show the reading, not the ask. */
  silenced: boolean;
}) {
  const { t } = useT();
  const router = useRouter();

  const [answer, setAnswer] = useState<"accepted" | "kept" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestion = trend.suggestion;
  const showDecision =
    suggestion !== null && suggestion.deltaKcal !== 0 && !silenced;

  const StatusIcon =
    trend.status === "TOO_FAST"
      ? TrendingDown
      : trend.status === "STALLED"
        ? Minus
        : trend.status === "TOO_SLOW"
          ? TrendingUp
          : Scale;

  async function answerSuggestion(accepted: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/plan-korekcija", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error_sr?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(
          payload.error_sr ??
            (response.status === 409
              ? t("merenje.suggest.stale")
              : t("merenje.suggest.error"))
        );
        return;
      }

      setAnswer(accepted ? "accepted" : "kept");
      // The new target has to reach every other screen (the ring on /danas
      // reads `targets`), so the whole tree is refreshed rather than patched.
      router.refresh();
    } catch {
      setError(t("merenje.suggest.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5" data-testid="weekly-result-card">
      <div className="flex items-center gap-2">
        <StatusIcon className="size-5 text-primary" aria-hidden={true} />
        <h2 className="text-lg font-semibold text-foreground">
          {t(STATUS_LABEL[trend.status])}
        </h2>
      </div>

      {/* The reading. Shown whenever there IS one -- even when the food log is
          too thin to say anything about the plan, because the scale is the
          user's own number and withholding it would be strange. */}
      {trend.trendKgPerWeek !== null && trend.expected ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("merenje.result.trend")}
            </dt>
            <dd
              className="font-semibold tabular-nums text-foreground"
              data-testid="weekly-trend-value"
            >
              {t("merenje.result.perWeek", {
                kg: formatKg(trend.trendKgPerWeek),
              })}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("merenje.result.expected")}
            </dt>
            <dd className="tabular-nums text-muted-foreground">
              {t("merenje.result.range", {
                from: formatKg(trend.expected.minKgPerWeek),
                to: formatKg(trend.expected.maxKgPerWeek),
              })}
            </dd>
          </div>
        </dl>
      ) : null}

      {/* The measurement against the prediction -- the sentence this whole
          feature exists to be able to say. */}
      {trend.measuredTdeeKcal !== null ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {t("merenje.result.measured")}
            </dt>
            <dd
              className="font-semibold tabular-nums text-foreground"
              data-testid="measured-tdee"
            >
              {t("merenje.result.kcalPerDay", {
                kcal: formatKcal(trend.measuredTdeeKcal),
              })}
            </dd>
          </div>
          {trend.plannedTdeeKcal !== null ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("merenje.result.planned")}
              </dt>
              <dd className="tabular-nums text-muted-foreground">
                {t("merenje.result.kcalPerDay", {
                  kcal: formatKcal(trend.plannedTdeeKcal),
                })}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <PlainLanguage trend={trend} />

      {trend.measuredTdeeKcal !== null && trend.avgDailyKcal !== null ? (
        <p className="text-xs text-muted-foreground">
          {t("merenje.result.basedOn", {
            days: String(trend.measuredDays),
            kcal: formatKcal(trend.avgDailyKcal),
          })}
        </p>
      ) : null}

      {trend.confidence === "low" && trend.status !== "INSUFFICIENT_DATA" ? (
        <Disclaimer testId="weekly-result-low-confidence">
          {t("merenje.result.lowConfidence")}
        </Disclaimer>
      ) : null}

      {showDecision && suggestion ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">
            {t(
              suggestion.direction === "cut"
                ? "merenje.suggest.cut"
                : "merenje.suggest.add",
              {
                kcal: formatKcal(suggestion.newDailyKcal),
                old: formatKcal(currentDailyKcal),
              }
            )}
          </p>

          {suggestion.extraSteps !== null ? (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Footprints
                className="size-4 shrink-0 translate-y-0.5 text-primary"
                aria-hidden={true}
              />
              {t("merenje.suggest.steps", {
                steps: suggestion.extraSteps.toLocaleString("sr-RS"),
              })}
            </p>
          ) : null}

          {suggestion.capped ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Activity
                className="size-4 shrink-0 translate-y-0.5"
                aria-hidden={true}
              />
              {t("merenje.suggest.capped")}
            </p>
          ) : null}

          {answer === null ? (
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => answerSuggestion(true)}
                disabled={pending}
                data-testid="accept-plan"
              >
                {pending
                  ? t("merenje.suggest.applying")
                  : t("merenje.suggest.accept")}
              </Button>
              <Button
                variant="outline"
                onClick={() => answerSuggestion(false)}
                disabled={pending}
                data-testid="keep-plan"
              >
                {t("merenje.suggest.keep")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-primary" role="status">
              {answer === "accepted"
                ? t("merenje.suggest.accepted", {
                    kcal: formatKcal(suggestion.newDailyKcal),
                  })
                : t("merenje.suggest.kept")}
            </p>
          )}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * The paragraph a person actually reads: template first, Gemini second.
 *
 * The template is not a degraded mode -- it is the guaranteed one. Every number
 * in the AI's version comes from this same `trend` object (the model is
 * forbidden to compute anything), so a failed, slow or quota-exhausted call
 * costs tone, never information.
 */
function PlainLanguage({ trend }: { trend: WeeklyTrendResult }) {
  const { t } = useT();

  const insufficient = trend.status === "INSUFFICIENT_DATA";
  // Written out rather than reusing `insufficient`: the inline comparison is
  // what narrows `trend.status` for the STATUS_EXPLAIN lookup below.
  const template =
    trend.status === "INSUFFICIENT_DATA"
      ? t(REASON_EXPLAIN[trend.reason ?? "few_weigh_ins"])
      : t(STATUS_EXPLAIN[trend.status]);

  const [text, setText] = useState(template);

  useEffect(() => {
    // Nothing to phrase: "we don't have the data" is already one clear
    // sentence, and spending a model call to reword it would be spending quota
    // on the one case where there is nothing to say.
    if (insufficient) return;

    let cancelled = false;
    const controller = new AbortController();

    // No body: the route recomputes every fact server-side, so there is
    // nothing here worth sending and nothing a client could tilt.
    fetch("/api/merenje/poruka", {
      method: "POST",
      signal: controller.signal,
    })
      .then((response) =>
        response.ok && response.status !== 204 ? response.json() : null
      )
      .then((payload: { ok?: boolean; data?: { text?: string } } | null) => {
        const next = payload?.data?.text?.trim();
        if (!cancelled && next) setText(next);
      })
      .catch(() => {
        // Silent on purpose: the template is already on screen.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trend.status, insufficient]);

  // "We can't read a trend yet" is a caveat, not a finding -- so it wears the
  // footnote's clothes rather than the verdict's. Everything else is the card
  // actually answering the question the user opened it with.
  if (insufficient) {
    return <Disclaimer testId="weekly-result-message">{text}</Disclaimer>;
  }

  return (
    <p
      className="text-sm leading-relaxed text-muted-foreground"
      data-testid="weekly-result-message"
    >
      {text}
    </p>
  );
}
