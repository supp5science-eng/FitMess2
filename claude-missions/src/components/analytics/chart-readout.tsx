"use client";

import { X } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

// The shared "you tapped a day" read-out used by every chart in Analitika
// (2026-07-25). Before this, the charts were pretty but mute: tapping a bar or a
// point did nothing, so the only concrete numbers on the screen were today's and
// the weekly average -- you could see that Wednesday was tall without ever
// learning what Wednesday actually was.
//
// Why a fixed row instead of a floating tooltip: this is a phone-only app, the
// charts are 7 columns wide inside a card, and a bubble anchored over the first
// or last column has to fight the card's edges (and the finger covering it).
// A row that lives in a fixed slot under the chart can never be clipped, works
// identically for bars and for line points, and leaves the tapped column free to
// simply highlight itself.
//
// Rules the cards follow with it:
//   * Nothing selected -> `ChartHint` invites the tap (same slot, so the card
//     never changes height when a day is picked).
//   * Selected -> the day is NAMED ("Sreda, 22. jul", from `analyticsDayLabel`)
//     and its real numbers are shown, with an ✕ to go back.
//   * Tapping the same day again clears it, so a mistap costs one tap.

export function ChartReadout({
  label,
  primary,
  secondary,
  accentColor,
  onClear,
  testId = "chart-readout",
}: {
  /** The day, already named by `analyticsDayLabel` ("Sreda, 22. jul"). */
  label: string;
  /** The headline figure for that day, e.g. "8.420 koraka". */
  primary: string;
  /** Optional second line, e.g. "84% dnevnog cilja". */
  secondary?: string;
  /** Tints the primary figure in the card's own accent. */
  accentColor?: string;
  onClear: () => void;
  testId?: string;
}) {
  const { t } = useT();
  return (
    <div
      data-testid={testId}
      role="status"
      className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className="truncate text-sm font-semibold tabular-nums text-foreground"
          style={accentColor ? { color: accentColor } : undefined}
        >
          {primary}
        </span>
        {secondary ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {secondary}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={t("analytics.readout.close")}
        data-testid={`${testId}-clear`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The same slot when nothing is selected: a quiet invitation to tap. */
export function ChartHint({
  children,
  testId = "chart-hint",
}: {
  children?: React.ReactNode;
  testId?: string;
}) {
  const { t } = useT();
  return (
    <p
      data-testid={testId}
      className="px-1 text-center text-[11px] text-muted-foreground"
    >
      {children ?? t("analytics.hint.default")}
    </p>
  );
}

/**
 * A row of full-height, invisible tap targets laid over an SVG line chart --
 * one per day. The SVG itself stays presentational (and server-renderable in
 * spirit); the buttons give real, keyboard-reachable, 44px-tall targets without
 * asking the user to hit a 4px dot with a thumb.
 */
export function DayTapTargets({
  days,
  selectedKey,
  onSelect,
  ariaLabel,
}: {
  days: { dayKey: string; longLabel: string }[];
  selectedKey: string | null;
  onSelect: (dayKey: string) => void;
  /** Builds each button's accessible name, e.g. `(d) => "Sreda: 8.420 koraka"`. */
  ariaLabel: (day: { dayKey: string; longLabel: string }) => string;
}) {
  return (
    <div className="absolute inset-0 flex">
      {days.map((day) => (
        <button
          key={day.dayKey}
          type="button"
          aria-label={ariaLabel(day)}
          aria-pressed={selectedKey === day.dayKey}
          data-testid={`day-tap-${day.dayKey}`}
          onClick={() => onSelect(day.dayKey)}
          className={cn(
            "flex-1 rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            selectedKey === day.dayKey ? "bg-foreground/[0.06]" : "bg-transparent"
          )}
        />
      ))}
    </div>
  );
}
