"use client";

import Link from "next/link";
import { Footprints, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  MiniWeekBars,
  type MiniWeekDay,
} from "@/components/home/mini-week-bars";
import { ProgressRing } from "@/components/home/progress-ring";
import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { sheetPortal } from "@/components/ui/sheet-portal";
import { FALLBACK_STEP_GOAL } from "@/lib/steps/step-goal";
import { cn } from "@/lib/utils";

// Koraci: an interactive step card on `/danas`. Steps are self-reported (a PWA
// can't read a pedometer/HealthKit), so this is a manual "roughly how much did
// I walk today" figure. The card shows a progress ring toward a daily goal;
// tapping it opens a bottom sheet where a live-filling ring, ± steppers, and
// walk/brisk/run presets make entering an estimate feel tactile.
//
// Same dependency-free overlay + delta pattern as `WaterButton`
// (`src/components/home/water-button.tsx`): the sheet composes a signed delta
// (presets/＋ add, − removes, floored so a mistap can be undone) and POSTs it to
// `/api/koraci`, which applies it to the day's running total server-side
// (clamped to [0, MAX]) and returns the new total — the source of truth this
// component then reflects.

/** Cap a single confirm can add (matches the DB/route bound). */
const MAX_STEPS = 200000;

/** Fine-tune step for the − / + steppers. */
const STEP = 500;

/** Quick-add presets: short walk / walk / long walk, rough step counts. The
 * `labelKey` is resolved through `t()` inside the component. */
const PRESETS: { steps: number; labelKey: string; sub: string; emoji: string }[] = [
  { steps: 500, labelKey: "home.steps.preset.short", sub: "500", emoji: "🚶" },
  { steps: 1000, labelKey: "home.steps.preset.walk", sub: "1.000", emoji: "🚶‍♂️" },
  { steps: 3000, labelKey: "home.steps.preset.long", sub: "3.000", emoji: "🏃" },
];

/** The violet arc, light -> dark (matches the "Koraci" accent used elsewhere). */
const STEPS_GRADIENT: [string, string, string] = [
  "#8b74c4",
  "#6f56ad",
  "#5f43a0",
];

interface KoraciResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: { day: string; steps: number };
}

/** `7240` -> `"7.240"` (Serbian thousands separator). */
function formatSteps(steps: number): string {
  return String(steps).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * A ± stepper that fires once on a tap/click (keyboard-friendly) and, while
 * held down, AUTO-REPEATS with acceleration — so "I walked way fewer steps"
 * is one long press instead of a dozen taps. The single tap still comes from
 * the click (identical feel to a normal button); pointer-hold adds the repeat,
 * and the click is suppressed only when the hold actually fired a repeat, so a
 * hold never double-counts.
 */
function StepperButton({
  onStep,
  disabled,
  ariaLabel,
  testId,
  children,
}: {
  onStep: () => void;
  disabled: boolean;
  ariaLabel: string;
  testId: string;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once a hold has fired at least one repeat — so the trailing click is
  // suppressed (the repeats already covered it).
  const repeatedRef = useRef(false);
  // Mirror `disabled` in a ref so an in-flight repeat loop can stop the moment
  // the value hits its floor/ceiling (the tick closure would otherwise be stale).
  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  function stop() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Clear any pending timer if the button unmounts mid-hold (e.g. sheet closes).
  useEffect(() => stop, []);

  function startHold() {
    repeatedRef.current = false;
    // Accelerating repeat: a beat before the first repeat (so a normal tap
    // doesn't repeat), then faster and faster down to a floor.
    let delay = 280;
    const tick = () => {
      if (disabledRef.current) {
        stop();
        return;
      }
      onStep();
      repeatedRef.current = true;
      delay = Math.max(28, delay * 0.8);
      timerRef.current = setTimeout(tick, delay);
    };
    timerRef.current = setTimeout(tick, delay);

    // Stop on release ANYWHERE (even if the button disabled itself mid-hold and
    // no longer receives the pointerup).
    const onUp = () => {
      stop();
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      onPointerDown={startHold}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (repeatedRef.current) {
          repeatedRef.current = false;
          return;
        }
        onStep();
      }}
      style={{ WebkitTouchCallout: "none" }}
      className="flex size-11 shrink-0 touch-none select-none items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40 active:translate-y-px"
    >
      {children}
    </button>
  );
}

export function StepsCard({
  dayKey,
  initialSteps = 0,
  goal = FALLBACK_STEP_GOAL,
  week = [],
  className,
}: {
  /** Belgrade calendar day (`"YYYY-MM-DD"`) this card logs steps for. */
  dayKey: string;
  /** The day's already-logged step total, read server-side. */
  initialSteps?: number;
  /** The daily step goal the ring fills toward. Resolved server-side from the
   * user's own setting or their activity level (`src/lib/steps/step-goal.ts`) --
   * NOT a flat 10.000 any more. Editable at `/profil/koraci`. */
  goal?: number;
  /** The last 7 days vs the goal, for the strip at the foot of the card
   * (server-derived by `computeStepsWeek`). Empty => the strip is not drawn. */
  week?: MiniWeekDay[];
  /** Layout hook for the caller. */
  className?: string;
}) {
  const { t } = useT();
  const [totalSteps, setTotalSteps] = useState(initialSteps);
  const [isOpen, setIsOpen] = useState(false);
  // The pending delta. Can be negative (remove steps), floored so it can never
  // take the day below zero.
  const [addSteps, setAddSteps] = useState(0);
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
    setAddSteps(0);
    setStatus("idle");
    setErrorMessage(undefined);
    setIsOpen(true);
  }

  function closeSheet() {
    if (status === "saving") return;
    setIsOpen(false);
  }

  /** Clamp a candidate delta to [−totalSteps (empty the day), +MAX_STEPS]. */
  function clampDelta(next: number): number {
    return Math.max(-totalSteps, Math.min(MAX_STEPS, next));
  }

  function bump(steps: number) {
    setStatus("idle");
    setErrorMessage(undefined);
    setAddSteps((current) => clampDelta(current + steps));
  }

  function onAmountChange(value: string) {
    setStatus("idle");
    setErrorMessage(undefined);
    // Manual entry composes a positive amount; removal is done with the −
    // stepper (a numeric keypad has no clean minus key).
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setAddSteps(digits === "" ? 0 : clampDelta(Number(digits)));
  }

  /**
   * POSTs a signed delta to `/api/koraci`, which applies it to the day's total
   * server-side and answers with the new total. Returns the new total, or the
   * Serbian error to show. Shared by the sheet's "Dodaj" and the card's chips.
   */
  async function postDelta(
    delta: number
  ): Promise<{ steps: number } | { error: string }> {
    try {
      const response = await fetch("/api/koraci", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: dayKey, deltaSteps: delta }),
      });
      const body = (await response.json()) as KoraciResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        return { error: body.error_sr || t("home.steps.saveFailed") };
      }
      return { steps: body.data.steps };
    } catch {
      return { error: t("home.steps.saveFailed") };
    }
  }

  async function onConfirm() {
    if (addSteps === 0) return;

    setStatus("saving");
    setErrorMessage(undefined);
    const result = await postDelta(addSteps);

    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }

    setTotalSteps(result.steps);
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

    setTotalSteps(result.steps);
    setQuickStatus("idle");
  }

  const resultSteps = Math.max(0, Math.min(MAX_STEPS, totalSteps + addSteps));
  const cardFraction = totalSteps / goal;
  // The strip is server-derived, but the day being viewed has to move the
  // moment a chip saves -- otherwise the ring updates and its own bar doesn't.
  const liveWeek = week.map((day) =>
    day.isToday ? { ...day, pct: goal > 0 ? totalSteps / goal : 0 } : day
  );
  const sheetFraction = resultSteps / goal;
  const goalReached = totalSteps >= goal;
  const confirmLabel =
    status === "saving"
      ? t("home.card.saving")
      : addSteps < 0
        ? t("home.card.remove")
        : t("home.card.add");

  return (
    <div className={cn("flex flex-col", className)}>
      {/* One card, three stacked parts, each hugging its content -- the card is
          NEVER stretched to fill the pager page (2026-07-25). Stretching it is
          exactly what produced the reported "everything floats, huge holes"
          look: the page is as tall as the calorie page, and the slack ended up
          as dead air inside the card. The 7-day strip is what earns that height
          honestly instead. */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5">
        <button
          type="button"
          onClick={openSheet}
          data-testid="steps-open-button"
          aria-label={t("home.steps.aria", { total: totalSteps, goal })}
          className="flex w-full items-center gap-3.5 text-left active:translate-y-px"
        >
          <ProgressRing
            fraction={cardFraction}
            size={58}
            stroke={6}
            trackClassName="text-violet-500/15"
            gradient={STEPS_GRADIENT}
          >
            <Footprints className="size-5 text-violet-500" aria-hidden="true" />
          </ProgressRing>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("home.steps.label")}
              </span>
              {goalReached ? (
                <span
                  data-testid="steps-goal-reached"
                  className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[0.7rem] font-semibold text-violet-500"
                >
                  {t("home.card.goalReached")}
                </span>
              ) : null}
            </span>
            <span
              data-testid="steps-total"
              className="text-2xl font-bold leading-none text-foreground tabular-nums"
            >
              {formatSteps(totalSteps)}
            </span>
            {/* Spelled out, not "0 / 10.000": the goal is a recommendation, and
                the user asked for it to say so. */}
            <span
              data-testid="steps-goal"
              className="text-xs text-muted-foreground"
            >
              {t("home.card.dailyGoal", { goal: formatSteps(goal) })}
            </span>
          </span>

          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </button>

        {/* One-tap presets: the common case ("prošetao sam") is now a single tap
            on the card, without opening the sheet at all. */}
        <div data-testid="steps-quick-add" className="grid grid-cols-3 gap-2">
          {PRESETS.map(({ steps, sub, emoji }) => (
            <button
              key={steps}
              type="button"
              disabled={quickStatus === "saving"}
              onClick={() => quickAdd(steps)}
              data-testid={`steps-quick-${steps}`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 active:translate-y-px"
            >
              <span className="text-base leading-none" aria-hidden="true">
                {emoji}
              </span>
              <span className="tabular-nums">+{sub}</span>
            </button>
          ))}
        </div>

        {quickStatus === "error" && errorMessage ? (
          <p
            role="alert"
            data-testid="steps-quick-error"
            className="text-center text-xs font-medium text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <MiniWeekBars
          days={liveWeek}
          testId="steps-week-bars"
          barClassName="bg-violet-500"
          trackClassName="bg-violet-500/10"
          todayLabelClassName="text-violet-500"
        />
      </div>

      {/* PORTALLED to <body> (2026-07-25): this card now lives inside the home
          pager's horizontal scroll container, and iOS Safari is unreliable about
          `position: fixed` inside a scroll container -- the sheet can end up
          positioned against the container instead of the viewport, or clipped by
          its overflow. Rendering it outside that subtree sidesteps the whole
          class of problem; nothing else about the sheet changes (RTL's `screen`
          queries still find it, since it queries the whole document). */}
      {isOpen ? sheetPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
          data-testid="steps-sheet-overlay"
          onClick={closeSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="steps-sheet-title"
            data-testid="steps-sheet"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-6 rounded-t-3xl border border-border bg-card px-6 pb-8 pt-6 shadow-lg sm:rounded-3xl"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
          >
            <div className="flex items-center justify-between">
              <span className="size-8" aria-hidden="true" />
              <h2
                id="steps-sheet-title"
                className="text-lg font-semibold text-foreground"
              >
                {t("home.steps.sheetTitle")}
              </h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label={t("home.close")}
                data-testid="steps-cancel-button"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Live-filling ring: the day's running total after applying the
                pending delta, out of the goal. Fills as the user taps presets /
                steppers — the interactive centrepiece. */}
            <div className="flex justify-center">
              <ProgressRing
                fraction={sheetFraction}
                size={168}
                stroke={14}
                trackClassName="text-violet-500/15"
                gradient={STEPS_GRADIENT}
              >
                <span className="flex flex-col items-center">
                  <span
                    data-testid="steps-sheet-total"
                    className="text-4xl font-bold text-foreground tabular-nums"
                  >
                    {formatSteps(resultSteps)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / {formatSteps(goal)}
                  </span>
                  {sheetFraction >= 1 ? (
                    <span className="mt-1 text-lg leading-none" aria-hidden="true">
                      🎉
                    </span>
                  ) : (
                    <Footprints
                      className="mt-1 size-4 text-violet-500"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </ProgressRing>
            </div>

            {/* − / + steppers around the pending delta, editable for an exact
                figure. */}
            <div className="flex items-center justify-center gap-4">
              <StepperButton
                onStep={() => bump(-STEP)}
                disabled={addSteps <= -totalSteps}
                ariaLabel={t("home.steps.minusAria", { n: STEP })}
                testId="steps-minus-button"
              >
                <Minus className="size-5" aria-hidden="true" />
              </StepperButton>

              <div className="flex items-baseline justify-center gap-1.5">
                <span
                  className="text-sm font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  {addSteps > 0 ? "+" : ""}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t("home.steps.inputAria")}
                  data-testid="steps-amount-input"
                  value={String(addSteps)}
                  onChange={(event) => onAmountChange(event.target.value)}
                  size={Math.max(1, String(addSteps).length)}
                  className="min-w-0 border-0 bg-transparent p-0 text-center text-3xl font-bold text-foreground tabular-nums outline-none focus:outline-none"
                />
                <span className="text-lg font-medium text-muted-foreground">
                  {t("home.steps.unit")}
                </span>
              </div>

              <StepperButton
                onStep={() => bump(STEP)}
                disabled={addSteps >= MAX_STEPS}
                ariaLabel={t("home.steps.plusAria", { n: STEP })}
                testId="steps-plus-button"
              >
                <Plus className="size-5" aria-hidden="true" />
              </StepperButton>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {PRESETS.map(({ steps, labelKey, sub, emoji }) => (
                <button
                  key={labelKey}
                  type="button"
                  onClick={() => bump(steps)}
                  data-testid={`steps-preset-${steps}`}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-center transition-colors hover:bg-muted/50 active:translate-y-px"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
                    {t(labelKey as MessageKey)}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    +{sub}
                  </span>
                </button>
              ))}
            </div>

            {status === "error" && errorMessage ? (
              <p
                role="alert"
                data-testid="steps-error"
                className="text-center text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={onConfirm}
                disabled={status === "saving" || addSteps === 0}
                data-testid="steps-save-button"
                className="h-12 w-full text-base"
              >
                {confirmLabel}
              </Button>
              <p
                data-testid="steps-result-preview"
                className="text-center text-xs text-muted-foreground"
              >
                {addSteps === 0
                  ? t("home.steps.loggedToday", { steps: formatSteps(totalSteps) })
                  : t("home.steps.totalToday", { steps: formatSteps(resultSteps) })}
              </p>
              {/* The goal is no longer a flat 10.000 nobody agreed to -- so it
                  has to be reachable from where it's shown. A Link, not a
                  button-in-a-button: the card's own tap target is a <button>,
                  the sheet is not. */}
              <Link
                href="/profil/koraci"
                data-testid="steps-edit-goal-link"
                className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("home.steps.editGoal", { goal: formatSteps(goal) })}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
