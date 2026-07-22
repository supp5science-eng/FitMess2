"use client";

import { Footprints, Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

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

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo korake. Pokušaj ponovo.";

/** Daily step goal the ring fills toward (a widely-used 10k default). */
const DAILY_STEP_GOAL = 10000;

/** Cap a single confirm can add (matches the DB/route bound). */
const MAX_STEPS = 200000;

/** Fine-tune step for the − / + steppers. */
const STEP = 500;

/** Quick-add presets: short walk / walk / long walk, rough step counts. */
const PRESETS: { steps: number; label: string; sub: string; emoji: string }[] = [
  { steps: 500, label: "Kratka", sub: "500", emoji: "🚶" },
  { steps: 1000, label: "Šetnja", sub: "1.000", emoji: "🚶‍♂️" },
  { steps: 3000, label: "Duga", sub: "3.000", emoji: "🏃" },
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

/** A circular progress ring with an iridescent violet gradient stroke. The
 * `fraction` (0..1) drives the fill; the caller places content in the centre. */
function ProgressRing({
  fraction,
  size,
  stroke,
  children,
}: {
  fraction: number;
  size: number;
  stroke: number;
  children?: React.ReactNode;
}) {
  const gradientId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = c * (1 - clamped);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-violet-500/15"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.45s cubic-bezier(0.2,0,0,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function StepsCard({
  dayKey,
  initialSteps = 0,
}: {
  /** Belgrade calendar day (`"YYYY-MM-DD"`) this card logs steps for. */
  dayKey: string;
  /** The day's already-logged step total, read server-side. */
  initialSteps?: number;
}) {
  const [totalSteps, setTotalSteps] = useState(initialSteps);
  const [isOpen, setIsOpen] = useState(false);
  // The pending delta. Can be negative (remove steps), floored so it can never
  // take the day below zero.
  const [addSteps, setAddSteps] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
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

  async function onConfirm() {
    if (addSteps === 0) return;

    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch("/api/koraci", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: dayKey, deltaSteps: addSteps }),
      });
      const body = (await response.json()) as KoraciResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || SAVE_FAILED_ERROR_SR);
        return;
      }

      setTotalSteps(body.data.steps);
      setStatus("idle");
      setIsOpen(false);
    } catch {
      setStatus("error");
      setErrorMessage(SAVE_FAILED_ERROR_SR);
    }
  }

  const resultSteps = Math.max(0, Math.min(MAX_STEPS, totalSteps + addSteps));
  const cardFraction = totalSteps / DAILY_STEP_GOAL;
  const sheetFraction = resultSteps / DAILY_STEP_GOAL;
  const goalReached = totalSteps >= DAILY_STEP_GOAL;
  const confirmLabel =
    status === "saving" ? "Čuvanje..." : addSteps < 0 ? "Ukloni" : "Dodaj";

  return (
    <div>
      <button
        type="button"
        onClick={openSheet}
        data-testid="steps-open-button"
        aria-label={`Koraci: ${totalSteps} od ${DAILY_STEP_GOAL}. Dodaj korake.`}
        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:translate-y-px"
      >
        <ProgressRing fraction={cardFraction} size={56} stroke={6}>
          <Footprints className="size-5 text-violet-500" aria-hidden="true" />
        </ProgressRing>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              Koraci
            </span>
            {goalReached ? (
              <span
                data-testid="steps-goal-reached"
                className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[0.7rem] font-semibold text-violet-500"
              >
                Cilj 🎉
              </span>
            ) : null}
          </span>
          <span className="text-sm text-muted-foreground">
            cilj {formatSteps(DAILY_STEP_GOAL)}
          </span>
        </span>

        <span className="flex items-center gap-2.5">
          <span
            data-testid="steps-total"
            className="text-lg font-bold text-foreground tabular-nums"
          >
            {formatSteps(totalSteps)}
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </span>
      </button>

      {isOpen ? (
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
                Unesi korake
              </h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Zatvori"
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
              <ProgressRing fraction={sheetFraction} size={168} stroke={14}>
                <span className="flex flex-col items-center">
                  <span
                    data-testid="steps-sheet-total"
                    className="text-4xl font-bold text-foreground tabular-nums"
                  >
                    {formatSteps(resultSteps)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / {formatSteps(DAILY_STEP_GOAL)}
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
                ariaLabel="Skini 500 koraka (drži za brže)"
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
                  aria-label="Broj koraka za dodavanje"
                  data-testid="steps-amount-input"
                  value={String(addSteps)}
                  onChange={(event) => onAmountChange(event.target.value)}
                  size={Math.max(1, String(addSteps).length)}
                  className="min-w-0 border-0 bg-transparent p-0 text-center text-3xl font-bold text-foreground tabular-nums outline-none focus:outline-none"
                />
                <span className="text-lg font-medium text-muted-foreground">
                  kor.
                </span>
              </div>

              <StepperButton
                onStep={() => bump(STEP)}
                disabled={addSteps >= MAX_STEPS}
                ariaLabel="Dodaj 500 koraka (drži za brže)"
                testId="steps-plus-button"
              >
                <Plus className="size-5" aria-hidden="true" />
              </StepperButton>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {PRESETS.map(({ steps, label, sub, emoji }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => bump(steps)}
                  data-testid={`steps-preset-${steps}`}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background px-2 py-3 text-center transition-colors hover:bg-muted/50 active:translate-y-px"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
                    {label}
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
                  ? `Uneseno danas: ${formatSteps(totalSteps)} koraka`
                  : `Ukupno danas: ${formatSteps(resultSteps)} koraka`}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
