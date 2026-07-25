"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  applyAddMore,
  componentPieceCount,
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
// sheet opens ALREADY ANSWERING the common case -- on an entry with no parts,
// "još 1" is pre-selected and the interaction is open → "Dodaj" -- while an
// itemised meal gets a stepper per food, starting at zero, because there the
// user does have something specific to say.
//
// Entries logged before 0019 (and everything from the catalog / Gric / voice)
// carry no breakdown, which would leave the feature able only to DOUBLE those
// meals. So the sheet asks for one on open (`POST /api/logs/[id]/razlozi`,
// once per entry, cached onto the row) rather than waiting for the user to
// photograph that meal again some other day. If the split fails, the sheet
// degrades to whole-entry seconds instead of blocking.
//
// The preview runs `applyAddMore`, the exact function the server re-runs
// against the stored row (`src/app/api/logs/[id]/dodaj/route.ts`) -- same
// guarantee as F026's edit sheet: what you see added is what gets written. Only
// unit counts go over the wire; no macro number is ever client-authored.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da dodamo. Pokušaj ponovo.";

interface LogResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: Log;
}

type Phase = "idle" | "splitting" | "saving";

export function LogAddMoreSheet({
  log,
  onSaved,
}: {
  log: Log;
  /** Called with the grown log row, so the day's ring/macros recompute. */
  onSaved?: (updatedLog: Log) => void;
}) {
  // The entry as the sheet currently knows it: the prop, then whatever the
  // split returns (the row gains `components` without its totals changing).
  const [entry, setEntry] = useState<Log>(log);
  const components = useMemo(
    () => readComponents(entry.components),
    [entry.components]
  );
  const hasBreakdown = components.length > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [whole, setWhole] = useState(0);
  const [units, setUnits] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [splitNote, setSplitNote] = useState<string | undefined>(undefined);

  const selection = useMemo<AddMoreSelection>(
    () => ({
      whole,
      components: units
        .map((value, index) => ({ index, units: value }))
        .filter((pick) => pick.units > 0),
    }),
    [whole, units]
  );

  const preview = useMemo(() => applyAddMore(entry, selection), [entry, selection]);

  async function openSheet() {
    setUnits(components.map(() => 0));
    setErrorMessage(undefined);
    setSplitNote(undefined);
    setIsOpen(true);

    if (hasBreakdown) {
      setWhole(0);
      setPhase("idle");
      return;
    }

    // No breakdown yet: ask for one. "Ceo obrok" stays at 0 while we wait so a
    // fast tapper can't confirm a doubling they didn't mean; it falls back to 1
    // only if the split doesn't arrive.
    setWhole(0);
    setPhase("splitting");
    try {
      const response = await fetch(`/api/logs/${entry.id}/razlozi`, {
        method: "POST",
      });
      const body = (await response.json()) as LogResponseBody;
      const split = body.ok && body.data ? readComponents(body.data.components) : [];

      if (split.length > 0 && body.data) {
        setEntry(body.data);
        setUnits(split.map(() => 0));
      } else {
        setWhole(1);
        setSplitNote(
          "Ovaj obrok nismo uspeli da razložimo na namirnice — možeš da dodaš ceo unos još jednom."
        );
      }
    } catch {
      setWhole(1);
      setSplitNote(
        "Ovaj obrok nismo uspeli da razložimo na namirnice — možeš da dodaš ceo unos još jednom."
      );
    } finally {
      setPhase("idle");
    }
  }

  function closeSheet() {
    if (phase === "saving") return;
    setIsOpen(false);
  }

  function stepWhole(delta: number) {
    setWhole((current) => Math.min(Math.max(current + delta, 0), MAX_UNITS));
    setErrorMessage(undefined);
  }

  function stepComponent(index: number, delta: number) {
    setUnits((current) =>
      current.map((value, i) =>
        i === index ? Math.min(Math.max(value + delta, 0), MAX_UNITS) : value
      )
    );
    setErrorMessage(undefined);
  }

  const canConfirm = !preview.isEmpty && phase === "idle";

  async function onConfirm() {
    if (!canConfirm) return;
    setPhase("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch(`/api/logs/${entry.id}/dodaj`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selection),
      });
      const body = (await response.json()) as LogResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setPhase("idle");
        setErrorMessage(body.error_sr || SAVE_FAILED_ERROR_SR);
        return;
      }

      setEntry(body.data);
      setPhase("idle");
      onSaved?.(body.data);
      setIsOpen(false);
    } catch {
      setPhase("idle");
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
              <p className="text-sm text-muted-foreground">{entry.name}</p>
            </div>

            {phase === "splitting" ? (
              <p
                data-testid="log-add-more-splitting"
                className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
              >
                Razlažemo obrok na namirnice…
              </p>
            ) : (
              <>
                {hasBreakdown ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Koliko si još pojeo/la
                    </p>
                    {components.map((component, index) => (
                      <StepperRow
                        key={`${component.naziv}-${index}`}
                        testId={`log-add-more-component-${index}`}
                        label={component.naziv}
                        detail={`u obroku: ${describeAmount(component)} · korak: ${componentUnitLabel(
                          component
                        )}`}
                        value={units[index] ?? 0}
                        onStep={(delta) => stepComponent(index, delta)}
                      />
                    ))}
                  </div>
                ) : null}

                {/* A one-food entry (a wafer, an apple) has a single part that
                    IS the whole entry, so a separate "Ceo obrok" row would be
                    the same stepper twice. */}
                {components.length === 1 ? null : (
                  <StepperRow
                    testId="log-add-more-whole"
                    label={hasBreakdown ? "Ceo obrok još jednom" : "Još isto"}
                    detail={`${Math.round(entry.kcal)} kcal · ${Math.round(
                      entry.grams
                    )} g`}
                    value={whole}
                    onStep={stepWhole}
                  />
                )}

                {splitNote ? (
                  <p
                    data-testid="log-add-more-split-note"
                    className="text-xs text-muted-foreground"
                  >
                    {splitNote}
                  </p>
                ) : null}
              </>
            )}

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

            {errorMessage ? (
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
                disabled={phase === "saving"}
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
                {phase === "saving" ? "Čuvanje..." : "Dodaj"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "6 × jaje" when the food has a natural unit, plain grams when it doesn't. */
function describeAmount(component: Parameters<typeof componentPieceCount>[0]): string {
  const count = componentPieceCount(component);
  const unitName = (component.kom_naziv ?? "").trim();
  if (count && unitName) return `${count} × ${unitName}`;
  return `${Math.round(component.grami)} g`;
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
