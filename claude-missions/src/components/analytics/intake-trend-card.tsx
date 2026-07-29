"use client";

import { useState } from "react";

import {
  ChartHint,
  ChartReadout,
  DayTapTargets,
} from "@/components/analytics/chart-readout";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import type {
  IntakeNoteKind,
  IntakeTrend,
  IntakeTrendPoint,
} from "@/lib/weight/intake-trend";

// Analitika "Procena težine" card: an estimated weight trend drawn from calorie
// intake (see `computeIntakeTrend`). Visual language borrowed from the app's
// weight-trend chart but restyled to the clean reference: a smooth violet line
// with hollow dots over a soft gradient, a divider, and a big estimated change
// with a nutrition note. Every number arrives pre-computed; `null` trend => a
// calm "dopuni profil" state (we can't estimate without TDEE + a current
// weight).
//
// Client since 2026-07-25 only so the line is TAPPABLE: picking a day names it
// and shows the estimate together with what was actually eaten that day, which
// is the number that explains the slope. An untracked day says so instead of
// pretending the flat stretch was a choice.

const LINE = "#8B7CF6"; // violet accent, matching the reference design

const VB_W = 320;
const VB_H = 92;
const PAD_X = 12;
const PAD_Y = 12;

/** Tone for each nutrition insight. Text is looked up via `t()` at render. */
const NOTE_TONE: Record<IntakeNoteKind, "good" | "warn" | "info"> = {
  no_data: "info",
  fat_high: "warn",
  protein_low: "warn",
  surplus: "info",
  on_track: "good",
};

/** Translated one-line nutrition insight for each note kind. */
function noteText(kind: IntakeNoteKind, t: TFunction): string {
  switch (kind) {
    case "no_data":
      return t("analytics.intake.note.noData");
    case "fat_high":
      return t("analytics.intake.note.fatHigh");
    case "protein_low":
      return t("analytics.intake.note.proteinLow");
    case "surplus":
      return t("analytics.intake.note.surplus");
    case "on_track":
      return t("analytics.intake.note.onTrack");
  }
}

const TONE_COLOR: Record<"good" | "warn" | "info", string> = {
  good: "var(--primary)",
  warn: "var(--chart-5)",
  info: "var(--muted-foreground)",
};

function fmtChange(kg: number): string {
  const abs = Math.abs(kg).toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = kg < -0.05 ? "−" : kg > 0.05 ? "+" : "±";
  return `${sign}${abs} kg`;
}

/** `82.4` -> `"82,4 kg"` (Serbian comma decimal). */
function fmtKg(kg: number): string {
  return `${kg.toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

/** The read-out's second line: what was eaten that day, and how it moved the
 * estimate. An untracked day is named as such -- never as "you ate 0". */
function secondaryFor(point: IntakeTrendPoint, t: TFunction): string {
  if (!point.hasLog) return t("analytics.intake.noMealsThatDay");
  const balance = point.balanceKcal;
  const direction =
    balance < 0
      ? t("analytics.intake.dir.below")
      : balance > 0
        ? t("analytics.intake.dir.above")
        : t("analytics.intake.dir.exact");
  return t("analytics.intake.eatenLine", {
    intake: point.intakeKcal.toLocaleString("sr-RS"),
    balance: Math.abs(balance).toLocaleString("sr-RS"),
    direction,
  });
}

export function IntakeTrendCard({ trend }: { trend: IntakeTrend | null }) {
  const { t } = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected =
    trend?.points.find((p) => p.dayKey === selectedKey) ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t("analytics.intake.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("analytics.intake.subtitle")}
        </p>
      </div>

      {trend ? (
        <>
          <div className="relative">
            <Sparkline trend={trend} selectedKey={selectedKey} />
            <DayTapTargets
              days={trend.points}
              selectedKey={selectedKey}
              onSelect={(dayKey) =>
                setSelectedKey((current) =>
                  current === dayKey ? null : dayKey
                )
              }
              ariaLabel={(day) => {
                const point = trend.points.find(
                  (p) => p.dayKey === day.dayKey
                )!;
                return `${day.longLabel}: ${t("analytics.intake.estimateValue", {
                  weight: fmtKg(point.estWeightKg),
                })}`;
              }}
            />
          </div>

          {selected ? (
            <ChartReadout
              label={selected.longLabel}
              primary={t("analytics.intake.estimateValue", {
                weight: fmtKg(selected.estWeightKg),
              })}
              secondary={secondaryFor(selected, t)}
              onClear={() => setSelectedKey(null)}
              testId="intake-trend-readout"
            />
          ) : (
            <ChartHint testId="intake-trend-hint">
              {t("analytics.intake.hint")}
            </ChartHint>
          )}

          <div className="h-px bg-border" />

          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span
                data-testid="intake-trend-change"
                className="text-3xl font-bold tabular-nums text-foreground"
              >
                {fmtChange(trend.estChangeKg)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("analytics.intake.changeLabel")}
              </span>
            </div>
            <NoteChip kind={trend.noteKind} />
          </div>
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          {t("analytics.intake.empty")}
        </p>
      )}
    </section>
  );
}

function Sparkline({
  trend,
  selectedKey,
}: {
  trend: IntakeTrend;
  selectedKey: string | null;
}) {
  const { t } = useT();
  const { points, minKg, maxKg } = trend;
  const span = Math.max(maxKg - minKg, 0.001);

  const xFor = (x: number) => PAD_X + x * (VB_W - 2 * PAD_X);
  // Higher weight sits higher up (smaller y).
  const yFor = (kg: number) =>
    PAD_Y + (1 - (kg - minKg) / span) * (VB_H - 2 * PAD_Y);

  const coords = points.map((p) => ({ x: xFor(p.x), y: yFor(p.estWeightKg) }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  // Area path: the line, then down to the baseline and back, for the gradient.
  const areaPath =
    `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${VB_H} ` +
    `L${coords[0]!.x.toFixed(1)},${VB_H} Z`;

  const selectedIndex = points.findIndex((p) => p.dayKey === selectedKey);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={t("analytics.intake.chartAria", {
        change: fmtChange(trend.estChangeKg),
      })}
      data-testid="intake-trend-chart"
    >
      <defs>
        <linearGradient id="intakeTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
          <stop offset="100%" stopColor={LINE} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#intakeTrendFill)" />
      <path
        d={linePath}
        fill="none"
        stroke={LINE}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* A vertical guide drops from the picked day, tying the line to the
          read-out below it. */}
      {selectedIndex >= 0 ? (
        <line
          x1={coords[selectedIndex]!.x}
          y1={0}
          x2={coords[selectedIndex]!.x}
          y2={VB_H}
          stroke={LINE}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
      ) : null}

      {/* Hollow dots (fill = card so the line doesn't show through the center);
          the selected day fills in and grows. */}
      {coords.map((c, i) => {
        const active = i === selectedIndex;
        return (
          <circle
            key={points[i]!.dayKey}
            cx={c.x}
            cy={c.y}
            r={active ? 6 : 4}
            fill={active ? LINE : "var(--card)"}
            stroke={LINE}
            strokeWidth={2.5}
          />
        );
      })}
    </svg>
  );
}

function NoteChip({ kind }: { kind: IntakeNoteKind }) {
  const { t } = useT();
  const color = TONE_COLOR[NOTE_TONE[kind]];
  return (
    <span
      data-testid="intake-trend-note"
      className="flex items-center gap-1.5 text-right text-xs font-medium text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {noteText(kind, t)}
    </span>
  );
}
