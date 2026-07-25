"use client";

import { GlassWater, Milk, Minus, Plus, X } from "lucide-react";
import { useState } from "react";

import {
  MiniWeekBars,
  type MiniWeekDay,
} from "@/components/home/mini-week-bars";
import { ProgressRing } from "@/components/home/progress-ring";
import { Button } from "@/components/ui/button";
import { sheetPortal } from "@/components/ui/sheet-portal";
import { cn } from "@/lib/utils";

// Voda: a compact water button on `/danas` that opens the "Unesi vodu" sheet.
// The button itself stays a single slim row (it must not crowd the dashboard);
// tapping it opens a bottom sheet where the user taps a glass/bottle/pitcher
// preset (or fine-tunes with ±250 steppers, or types an amount) and confirms.
//
// Same dependency-free overlay pattern as `WeighInSheet`
// (`src/components/analytics/weigh-in-sheet.tsx`): a fixed `bg-black/50`
// overlay, `role="dialog"`, and a small `idle | saving | error` status machine.
//
// The sheet composes a DELTA that can be NEGATIVE: the presets/+ add to the
// shown amount, the − stepper removes (floored at "empty the day"), so an
// accidental double-tap can be undone. On confirm it POSTs that delta to
// `/api/voda`, which applies it to the day's running total server-side (clamped
// to >= 0) and returns the new total — the source of truth this component then
// reflects.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo vodu. Pokušaj ponovo.";

/** Cap the amount a single confirm can add (matches the DB/route bound). */
const MAX_ML = 20000;

/** Fine-tune step for the − / + steppers. */
const STEP_ML = 250;

/** Quick-add presets, in the reference's order (glass → bottle → large). */
const PRESETS: { ml: number; label: string; sub: string; icon: typeof GlassWater }[] = [
  { ml: 250, label: "+1 čaša", sub: "250 mL", icon: GlassWater },
  { ml: 500, label: "+1 flaša", sub: "500 mL", icon: Milk },
  { ml: 750, label: "+1 velika flaša", sub: "750 mL", icon: Milk },
];

/** The sky arc, light -> dark (the "Voda" accent, mirroring Koraci's violet). */
const WATER_GRADIENT: [string, string, string] = [
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
];

interface VodaResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: { day: string; ml: number };
}

/** `1250` -> `"1,25 L"`, `250` -> `"250 mL"` (Serbian comma decimal). */
function formatWaterSr(ml: number): string {
  if (ml < 1000) return `${ml} mL`;
  const liters = ml / 1000;
  const trimmed = liters
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${trimmed} L`;
}

export function WaterButton({
  dayKey,
  initialMl = 0,
  goalMl,
  week = [],
  className,
}: {
  /** Belgrade calendar day (`"YYYY-MM-DD"`) this button logs water for. */
  dayKey: string;
  /** The day's already-logged water total (ml), read server-side. */
  initialMl?: number;
  /** Recommended daily water goal (ml), from bodyweight — the SAME
   * `waterGoalMl` the Analitika card uses. When set, the card states it as
   * "Dnevni cilj" and the ring fills toward it; omitted => just the total. */
  goalMl?: number;
  /** The last 7 days vs the goal, for the strip at the foot of the card
   * (server-derived by `computeWaterWeek`). Empty => the strip is not drawn. */
  week?: MiniWeekDay[];
  /** Layout hook for the caller. */
  className?: string;
}) {
  const [totalMl, setTotalMl] = useState(initialMl);
  const [isOpen, setIsOpen] = useState(false);
  // The pending delta. Can be negative (remove water), floored so it can never
  // take the day below empty.
  const [addMl, setAddMl] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );
  // One-tap quick-add straight from the card (no sheet). Own little status so a
  // failed chip tap can't disturb the sheet's state, or vice versa.
  const [quickStatus, setQuickStatus] = useState<"idle" | "saving" | "error">(
    "idle"
  );

  function openSheet() {
    setAddMl(0);
    setStatus("idle");
    setErrorMessage(undefined);
    setIsOpen(true);
  }

  function closeSheet() {
    if (status === "saving") return;
    setIsOpen(false);
  }

  /** Clamp a candidate delta to [−totalMl (empty the day), +MAX_ML]. */
  function clampDelta(next: number): number {
    return Math.max(-totalMl, Math.min(MAX_ML, next));
  }

  function bump(ml: number) {
    setStatus("idle");
    setErrorMessage(undefined);
    setAddMl((current) => clampDelta(current + ml));
  }

  function onAmountChange(value: string) {
    setStatus("idle");
    setErrorMessage(undefined);
    // Manual entry composes a positive amount; removal is done with the −
    // stepper (a numeric keypad has no clean minus key).
    const digits = value.replace(/\D/g, "").slice(0, 5);
    setAddMl(digits === "" ? 0 : clampDelta(Number(digits)));
  }

  /**
   * POSTs a signed delta to `/api/voda`, which applies it to the day's total
   * server-side and answers with the new total. Returns the new total, or the
   * Serbian error to show. Shared by the sheet's "Dodaj" and the card's chips.
   */
  async function postDelta(
    delta: number
  ): Promise<{ ml: number } | { error: string }> {
    try {
      const response = await fetch("/api/voda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: dayKey, deltaMl: delta }),
      });
      const body = (await response.json()) as VodaResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        return { error: body.error_sr || SAVE_FAILED_ERROR_SR };
      }
      return { ml: body.data.ml };
    } catch {
      return { error: SAVE_FAILED_ERROR_SR };
    }
  }

  async function onConfirm() {
    if (addMl === 0) return;

    setStatus("saving");
    setErrorMessage(undefined);
    const result = await postDelta(addMl);

    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }

    setTotalMl(result.ml);
    setStatus("idle");
    setIsOpen(false);
  }

  /** Chip tap on the card: save the preset immediately, no sheet, no confirm. */
  async function quickAdd(delta: number) {
    if (quickStatus === "saving") return;

    setQuickStatus("saving");
    setErrorMessage(undefined);
    const result = await postDelta(delta);

    if ("error" in result) {
      setQuickStatus("error");
      setErrorMessage(result.error);
      return;
    }

    setTotalMl(result.ml);
    setQuickStatus("idle");
  }

  const resultMl = Math.max(0, Math.min(MAX_ML, totalMl + addMl));
  // The strip is server-derived, but the day being viewed has to move the moment
  // a chip saves -- otherwise the ring updates and its own bar doesn't.
  const liveWeek = week.map((day) =>
    day.isToday
      ? { ...day, pct: goalMl && goalMl > 0 ? totalMl / goalMl : 0 }
      : day
  );
  const confirmLabel =
    status === "saving" ? "Čuvanje..." : addMl < 0 ? "Ukloni" : "Dodaj";

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Same anatomy as the Koraci card (2026-07-25): summary row, one-tap
          presets, 7-day strip. The card hugs its content and is NEVER stretched
          to fill the pager page -- stretching it is what produced the reported
          "huge holes inside the cards". */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
        <button
          type="button"
          onClick={openSheet}
          data-testid="water-open-button"
          aria-label={`Voda: ${formatWaterSr(totalMl)}${
            goalMl ? ` od ${formatWaterSr(goalMl)}` : ""
          }. Dodaj vodu.`}
          className="flex w-full items-center gap-3.5 text-left active:translate-y-px"
        >
          <ProgressRing
            fraction={goalMl ? totalMl / goalMl : 0}
            size={58}
            stroke={6}
            trackClassName="text-sky-500/15"
            gradient={WATER_GRADIENT}
          >
            <Milk className="size-5 text-sky-400" aria-hidden="true" />
          </ProgressRing>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Voda
              </span>
              {goalMl && totalMl >= goalMl ? (
                <span
                  data-testid="water-goal-reached"
                  className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[0.7rem] font-semibold text-sky-400"
                >
                  Cilj 🎉
                </span>
              ) : null}
            </span>
            <span
              data-testid="water-total"
              className="text-2xl font-bold leading-none text-foreground tabular-nums"
            >
              {formatWaterSr(totalMl)}
            </span>
            {/* Spelled out, not "0 mL / 3,1 L": the goal is a recommendation,
                and the user asked for it to say so. */}
            {goalMl ? (
              <span
                data-testid="water-goal"
                className="text-xs text-muted-foreground"
              >
                Dnevni cilj: {formatWaterSr(goalMl)}
              </span>
            ) : null}
          </span>

          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </button>

        {/* One-tap presets: a glass of water is now a single tap on the card. */}
        <div data-testid="water-quick-add" className="grid grid-cols-3 gap-2">
          {PRESETS.map(({ ml, sub, icon: Icon }, index) => (
            <button
              key={ml}
              type="button"
              disabled={quickStatus === "saving"}
              onClick={() => quickAdd(ml)}
              data-testid={`water-quick-${ml}`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 active:translate-y-px"
            >
              <Icon
                className={cn("shrink-0 text-sky-400", index === 2 ? "size-5" : "size-4")}
                aria-hidden="true"
              />
              <span className="tabular-nums">+{sub.replace(" mL", "")}</span>
            </button>
          ))}
        </div>

        {quickStatus === "error" && errorMessage ? (
          <p
            role="alert"
            data-testid="water-quick-error"
            className="text-center text-xs font-medium text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <MiniWeekBars
          days={liveWeek}
          testId="water-week-bars"
          barClassName="bg-sky-400"
          trackClassName="bg-sky-500/10"
          todayLabelClassName="text-sky-400"
        />
      </div>

      {/* PORTALLED to <body>: this button now lives inside the home pager's
          horizontal scroll container, where iOS Safari cannot be trusted to keep
          a `position: fixed` overlay anchored to the viewport (see
          `sheetPortal`). */}
      {isOpen ? sheetPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
          data-testid="water-sheet-overlay"
          onClick={closeSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="water-sheet-title"
            data-testid="water-sheet"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-6 rounded-t-3xl border border-border bg-card px-6 pb-8 pt-6 shadow-lg sm:rounded-3xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
          >
            <div className="flex items-center justify-between">
              <span className="size-8" aria-hidden="true" />
              <h2
                id="water-sheet-title"
                className="text-lg font-semibold text-foreground"
              >
                Unesi vodu
              </h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Zatvori"
                data-testid="water-cancel-button"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Amount to apply, with − / + steppers so a mistaken tap can be
                walked back. The number is editable for an exact figure. */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => bump(-STEP_ML)}
                disabled={addMl <= -totalMl}
                aria-label="Skini 250 mL"
                data-testid="water-minus-button"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40 active:translate-y-px"
              >
                <Minus className="size-5" aria-hidden="true" />
              </button>

              <div className="flex items-baseline justify-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Količina vode u mililitrima"
                  data-testid="water-amount-input"
                  value={String(addMl)}
                  onChange={(event) => onAmountChange(event.target.value)}
                  size={Math.max(1, String(addMl).length)}
                  className="min-w-0 border-0 bg-transparent p-0 text-center text-5xl font-bold text-foreground tabular-nums outline-none focus:outline-none"
                />
                <span className="text-xl font-medium text-muted-foreground">
                  mL
                </span>
              </div>

              <button
                type="button"
                onClick={() => bump(STEP_ML)}
                disabled={addMl >= MAX_ML}
                aria-label="Dodaj 250 mL"
                data-testid="water-plus-button"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40 active:translate-y-px"
              >
                <Plus className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {PRESETS.map(({ ml, label, sub, icon: Icon }, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => bump(ml)}
                  data-testid={`water-preset-${ml}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-background px-2 py-3 text-center transition-colors hover:bg-muted/50 active:translate-y-px"
                >
                  <Icon
                    className={cn("text-sky-400", index === 2 ? "size-7" : "size-6")}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold leading-tight text-foreground">
                    {label}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {sub}
                  </span>
                </button>
              ))}
            </div>

            {status === "error" && errorMessage ? (
              <p
                role="alert"
                data-testid="water-error"
                className="text-center text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={onConfirm}
                disabled={status === "saving" || addMl === 0}
                data-testid="water-save-button"
                className="h-12 w-full text-base"
              >
                {confirmLabel}
              </Button>
              <p
                data-testid="water-result-preview"
                className="text-center text-xs text-muted-foreground"
              >
                {addMl === 0
                  ? `Uneseno: ${formatWaterSr(totalMl)}`
                  : `Ukupno danas: ${formatWaterSr(resultMl)}`}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
