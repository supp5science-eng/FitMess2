"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  applyAddMore,
  componentUnitLabel,
  MAX_UNITS,
  readComponents,
  type AddMoreSelection,
} from "@/lib/log/add-more";
import type { Log } from "@/lib/types/db";

// "Dodaj još" (2026-07-25): the sheet that lets you eat seconds without
// photographing them.
//
// The design problem is that "I ate one more wafer" and "I went back for two
// more eggs and a spoon of sour cream" are the same intention at different
// resolutions, and the second one must not make the first one slower. So the
// sheet opens ALREADY ANSWERING the common case -- on an entry with no
// breakdown, "još 1" is pre-selected and the whole interaction is open →
// "Dodaj" -- while an itemised meal gets a stepper per part, starting at zero,
// because there the user does have something specific to say.
//
// The preview runs `applyAddMore`, the exact function the server re-runs
// against the stored row after the request arrives (see
// `src/app/api/logs/[id]/dodaj/route.ts`) -- same guarantee as F026's edit
// sheet: what you see added is what gets written. Only unit counts go over the
// wire; no macro number is ever client-authored.
//
// Same dependency-free overlay pattern as `LogEditSheet` (no Sheet primitive
// exists in this codebase) and the same self-contained trigger, so a meal card
// only has to drop `<LogAddMoreSheet log={log} onSaved={...} />` in place.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da dodamo. Pokušaj ponovo.";

interface AddMoreResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: Log;
}

export function LogAddMoreSheet({
  log,
  onSaved,
}: {
  log: Log;
  /** Called with the grown log row, so the day's ring/macros recompute. */
  onSaved?: (updatedLog: Log) => void;
}) {
  const components = useMemo(() => readComponents(log.components), [log.components]);
  const hasBreakdown = components.length > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [whole, setWhole] = useState(0);
  const [units, setUnits] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const selection = useMemo<AddMoreSelection>(
    () => ({
      whole,
      components: units
        .map((value, index) => ({ index, units: value }))
        .filter((pick) => pick.units > 0),
    }),
    [whole, units]
  );

  const preview = useMemo(
    () => applyAddMore(log, selection),
    [log, selection]
  );

  function openSheet() {
    // An entry with no parts has exactly one thing you could mean, so mean it
    // for the user: one tap to open, one to confirm.
    setWhole(hasBreakdown ? 0 : 1);
    setUnits(components.map(() => 0));
    setStatus("idle");
    setErrorMessage(undefined);
    setIsOpen(true);
  }

  function closeSheet() {
    if (status === "saving") return;
    setIsOpen(false);
  }

  function stepWhole(delta: number) {
    setWhole((current) => Math.min(Math.max(current + delta, 0), MAX_UNITS));
    setStatus("idle");
  }

  function stepComponent(index: number, delta: number) {
    setUnits((current) =>
      current.map((value, i) =>
        i === index ? Math.min(Math.max(value + delta, 0), MAX_UNITS) : value
      )
    );
    setStatus("idle");
  }

  const canConfirm = !preview.isEmpty && status !== "saving";

  async function onConfirm() {
    if (!canConfirm) return;
    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch(`/api/logs/${log.id}/dodaj`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selection),
      });
      const body = (await response.json()) as AddMoreResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || SAVE_FAILED_ERROR_SR);
        return;
      }

      setStatus("idle");
      onSaved?.(body.data);
      setIsOpen(false);
    } catch {
      setStatus("error");
      setErrorMessage(SAVE_FAILED_ERROR_SR);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={openSheet}
        data-testid={`log-add-more-open-${log.id}`}
      >
        <Plus className="size-4" aria-hidden="true" />
        Dodaj još
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
          data-testid="log-add-more-overlay"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-add-more-title"
            data-testid="log-add-more-sheet"
            className="flex max-h-[85vh] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-t-2xl border border-border bg-background px-5 py-7 shadow-lg sm:rounded-2xl"
          >
            <div className="flex flex-col gap-1">
              <h2
                id="log-add-more-title"
                className="text-lg font-semibold text-foreground"
              >
                Dodaj još
              </h2>
              <p className="text-sm text-muted-foreground">{log.name}</p>
            </div>

            <StepperRow
              testId="log-add-more-whole"
              label={hasBreakdown ? "Ceo obrok još jednom" : "Još isto"}
              detail={`${Math.round(log.kcal)} kcal · ${Math.round(log.grams)} g`}
              value={whole}
              onStep={stepWhole}
            />

            {hasBreakdown ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ili samo deo obroka
                </p>
                {components.map((component, index) => (
                  <StepperRow
                    key={`${component.naziv}-${index}`}
                    testId={`log-add-more-component-${index}`}
                    label={component.naziv}
                    detail={componentUnitLabel(component)}
                    value={units[index] ?? 0}
                    onStep={(delta) => stepComponent(index, delta)}
                  />
                ))}
              </div>
            ) : null}

            <div
              data-testid="log-add-more-preview"
              className="flex items-baseline justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">Dodajemo</span>
              <span
                data-testid="log-add-more-preview-kcal"
                className="text-2xl font-bold tabular-nums text-foreground"
              >
                +{preview.addedKcal} kcal
              </span>
            </div>
            <p className="-mt-3 text-right text-xs text-muted-foreground">
              Ukupno posle dodavanja: {preview.totals.kcal} kcal
            </p>

            {status === "error" && errorMessage ? (
              <p
                role="alert"
                data-testid="log-add-more-error"
                className="text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeSheet}
                disabled={status === "saving"}
                data-testid="log-add-more-cancel"
              >
                Otkaži
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                data-testid="log-add-more-save"
              >
                {status === "saving" ? "Čuvanje..." : "Dodaj"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One "− 0 +" row. Big round targets: this is a one-handed, mid-meal control. */
function StepperRow({
  testId,
  label,
  detail,
  value,
  onStep,
}: {
  testId: string;
  label: string;
  detail: string;
  value: number;
  onStep: (delta: number) => void;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={`Smanji: ${label}`}
          data-testid={`${testId}-minus`}
          onClick={() => onStep(-1)}
          disabled={value === 0}
          className="flex size-9 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span
          data-testid={`${testId}-value`}
          className="w-6 text-center text-base font-semibold tabular-nums text-foreground"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Dodaj: ${label}`}
          data-testid={`${testId}-plus`}
          onClick={() => onStep(1)}
          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
