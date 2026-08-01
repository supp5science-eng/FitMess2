"use client";

import "./eaten-share.css";

import { useT } from "@/components/i18n/locale-provider";
import {
  EATEN_SHARE_STEP,
  FULL_EATEN_SHARE,
  MIN_EATEN_SHARE,
  clampEatenShare,
  eatenShareLabelKey,
} from "@/lib/log/eaten-share";

// "Nisam pojeo sve" — one slider, on the confirm screen of every photo flow.
//
// It sits VISIBLE rather than folded behind "Ispravi", which is a deliberate
// exception to the fast path's "one card, one button" rule: a control nobody
// finds cannot fix a number, and half-eaten plates are common enough that the
// alternative is a day total that is quietly too high. It costs three lines and
// zero taps for the person who cleaned the plate, because 100% is the default
// and changes nothing.
//
// The percentage is the input; grams are the OUTPUT, shown small underneath.
// That order matters: people can judge "about half a plate" by looking at it,
// and cannot judge "210 g". The flow converts the share into grams and reuses
// the same per-100 g rescale the gram field always used, so macros, micros and
// the itemised breakdown can never drift apart from each other.

export function EatenShare({
  share,
  onShareChange,
  eatenGrams,
  eatenKcal,
  servedKcal,
  disabled = false,
}: {
  /** Percentage of the served plate that was eaten (5–100). */
  share: number;
  onShareChange: (share: number) => void;
  /** What that share works out to, for the readout under the track. */
  eatenGrams: number;
  eatenKcal: number;
  /** The whole plate, so we can say what was left behind. */
  servedKcal: number;
  disabled?: boolean;
}) {
  const { t } = useT();
  const value = clampEatenShare(share);
  const isWholePlate = value >= FULL_EATEN_SHARE;
  const leftKcal = Math.max(Math.round(servedKcal - eatenKcal), 0);
  // Fills the track from the left edge to the thumb. The range starts at
  // MIN_EATEN_SHARE, not at 0, so the fill has to be measured against the
  // usable span or the paint would sit ahead of the thumb.
  const fill =
    ((value - MIN_EATEN_SHARE) / (FULL_EATEN_SHARE - MIN_EATEN_SHARE)) * 100;

  return (
    <div
      data-testid="eaten-share"
      className="flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/40 px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {t("dodaj.eaten.question")}
        </span>
        <span
          data-testid="eaten-share-value"
          className="text-lg font-semibold tabular-nums text-primary"
        >
          {value}%
        </span>
      </div>

      <input
        className="es-range"
        type="range"
        min={MIN_EATEN_SHARE}
        max={FULL_EATEN_SHARE}
        step={EATEN_SHARE_STEP}
        value={value}
        disabled={disabled}
        aria-label={t("dodaj.eaten.question")}
        // Screen readers get the words, not just the number -- the same thing
        // the sighted user reads under the track.
        aria-valuetext={`${value}% · ${t(eatenShareLabelKey(value))}`}
        data-testid="eaten-share-range"
        onChange={(event) => onShareChange(clampEatenShare(Number(event.target.value)))}
        style={{ ["--es-fill" as string]: `${fill}%` }}
      />

      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span>{t(eatenShareLabelKey(value))}</span>
        <span className="shrink-0 tabular-nums">
          {Math.round(eatenGrams)} g · {Math.round(eatenKcal)} kcal
        </span>
      </div>

      {/* Only when something was actually left. Saying "0 kcal nije ušlo" to
          someone who finished their plate would be noise. */}
      {!isWholePlate ? (
        <p data-testid="eaten-share-left" className="text-xs text-primary">
          {t("dodaj.eaten.left", { kcal: leftKcal })}
        </p>
      ) : null}
    </div>
  );
}
