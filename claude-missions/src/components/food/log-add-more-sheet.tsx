"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useCountUp } from "@/components/home/animated-number";
import { Button } from "@/components/ui/button";
import { foodEmoji } from "@/lib/food/emoji";
import {
  applyAddMore,
  componentPieceCount,
  MAX_UNITS,
  readComponents,
  type AddMoreSelection,
} from "@/lib/log/add-more";
import { formatUnitCount } from "@/lib/log/units-sr";
import type { Log, LogComponentSnapshot } from "@/lib/types/db";

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
// The tone is doing real work here. This screen is read mid-snack, in the two
// seconds between "I ate another one" and putting the phone down, so it speaks
// in the user's own words -- "u obroku: 6 jaja", "+2 jajeta" -- rather than in
// grams and rows. That is also why the unit forms go through `units-sr.ts`
// instead of a naive "2 jaje": getting the grammar right is most of what makes
// software feel like it was written by a person who eats.
//
// The preview runs `applyAddMore`, the exact function the server re-runs
// against the stored row (`src/app/api/logs/[id]/dodaj/route.ts`) -- same
// guarantee as F026's edit sheet: what you see added is what gets written. Only
// unit counts go over the wire; no macro number is ever client-authored.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da dodamo. Pokušaj ponovo.";
const SPLIT_NOTE_SR =
  "Ovaj obrok nismo uspeli da razložimo na namirnice — možeš da dodaš ceo unos još jednom.";

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
  // Tweens on every change of the added figure, so the number visibly RESPONDS
  // to each tap instead of jumping -- the tap and the consequence read as one
  // motion.
  const shownKcal = Math.round(useCountUp(preview.addedKcal, preview.addedKcal, 260));

  /** The chips under the steppers: what is about to be added, in words. */
  const additions = useMemo(() => {
    const picked = components
      .map((component, index) => ({ component, count: units[index] ?? 0 }))
      .filter((entryPick) => entryPick.count > 0)
      .map(({ component, count }) =>
        formatUnitCount(count, component.kom_naziv) === String(count)
          ? `${count} × ${component.naziv}`
          : formatUnitCount(count, component.kom_naziv)
      );
    if (whole > 0) {
      picked.unshift(whole === 1 ? "ceo obrok" : `${whole} × ceo obrok`);
    }
    return picked;
  }, [components, units, whole]);

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
        setSplitNote(SPLIT_NOTE_SR);
      }
    } catch {
      setWhole(1);
      setSplitNote(SPLIT_NOTE_SR);
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 backdrop-blur-[2px] sm:items-center sm:px-6"
          data-testid="log-add-more-overlay"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-add-more-title"
            data-testid="log-add-more-sheet"
            className="flex max-h-[88vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-t-3xl border border-border bg-background px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-3xl sm:pb-7"
          >
            {/* Grab handle: tells the thumb this panel belongs to the bottom of
                the screen, the same way every native sheet does. */}
            <div
              aria-hidden="true"
              className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            />

            <header className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl"
              >
                {foodEmoji(entry.name)}
              </span>
              <div className="flex min-w-0 flex-col">
                <h2
                  id="log-add-more-title"
                  className="line-clamp-2 text-base font-semibold text-foreground"
                >
                  {entry.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  do sada: {Math.round(entry.kcal)} kcal · {Math.round(entry.grams)} g
                </p>
              </div>
            </header>

            {phase === "splitting" ? (
              <div
                data-testid="log-add-more-splitting"
                className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center"
              >
                <span className="flex gap-1" aria-hidden="true">
                  <Dot delay="0ms" />
                  <Dot delay="120ms" />
                  <Dot delay="240ms" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Gledamo od čega se sastoji…
                </p>
                <p className="text-xs text-muted-foreground">
                  Da možeš da dodaš samo ono što si stvarno pojeo/la.
                </p>
              </div>
            ) : (
              <>
                {hasBreakdown ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Koliko si još pojeo/la?
                    </p>
                    {components.map((component, index) => (
                      <StepperRow
                        key={`${component.naziv}-${index}`}
                        testId={`log-add-more-component-${index}`}
                        label={capitalize(component.naziv)}
                        detail={`u obroku: ${describeAmount(component)}`}
                        stepHint={stepHint(component)}
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
                    stepHint={null}
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
              className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition-colors ${
                preview.isEmpty
                  ? "border-border bg-card"
                  : "border-primary/40 bg-primary/[0.07]"
              }`}
            >
              {additions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {additions.map((text) => (
                    <span
                      key={text}
                      className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      +{text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dodirni + kod onoga što si još pojeo/la.
                </p>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <span
                  data-testid="log-add-more-preview-kcal"
                  className={`text-3xl font-bold tabular-nums ${
                    preview.isEmpty ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  +{shownKcal}
                  <span className="ml-1 text-base font-semibold">kcal</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  obrok postaje {preview.totals.kcal} kcal
                </span>
              </div>
            </div>

            {errorMessage ? (
              <p
                role="alert"
                data-testid="log-add-more-error"
                className="text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeSheet}
                disabled={phase === "saving"}
                data-testid="log-add-more-cancel"
                className="flex-1"
              >
                Otkaži
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                data-testid="log-add-more-save"
                className="flex-[1.6]"
              >
                {phase === "saving" ? "Čuvamo…" : "Dodaj"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The model returns part names in running-text case ("jaja", "kisela
 * pavlaka"); as a standalone row title that reads like an unfinished sentence,
 * so it gets a capital. Only the first letter -- "Kisela Pavlaka" would be
 * English title case, which Serbian doesn't use.
 */
function capitalize(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("sr-Latn") + trimmed.slice(1);
}

/** One pulsing dot of the "we're looking at your meal" indicator. */
function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-pulse rounded-full bg-primary"
      style={{ animationDelay: delay }}
    />
  );
}

/** "6 jaja" when the food has a natural unit, plain grams when it doesn't. */
function describeAmount(component: LogComponentSnapshot): string {
  const count = componentPieceCount(component);
  const unitName = (component.kom_naziv ?? "").trim();
  if (count && unitName) return formatUnitCount(count, unitName);
  return `${Math.round(component.grami)} g`;
}

/** What one tap of "+" adds, said the way the user would say it. */
function stepHint(component: LogComponentSnapshot): string | null {
  const unitName = (component.kom_naziv ?? "").trim();
  const unitGrams = component.kom_grami ?? 0;
  if (!unitName || unitGrams <= 0) return null;
  return `+1 ${unitName}`;
}

/** One "− 0 +" row. Big round targets: this is a one-handed, mid-meal control. */
function StepperRow({
  testId,
  label,
  detail,
  stepHint: hint,
  value,
  onStep,
}: {
  testId: string;
  label: string;
  detail: string;
  stepHint: string | null;
  value: number;
  onStep: (delta: number) => void;
}) {
  const active = value > 0;
  return (
    <div
      data-testid={testId}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
        active ? "border-primary/50 bg-primary/[0.07]" : "border-border bg-card"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {detail}
          {hint ? <span className="text-primary"> · {hint}</span> : null}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`Smanji: ${label}`}
          data-testid={`${testId}-minus`}
          onClick={() => onStep(-1)}
          disabled={value === 0}
          className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-opacity disabled:opacity-25"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span
          data-testid={`${testId}-value`}
          className={`w-7 text-center text-lg font-bold tabular-nums ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Dodaj: ${label}`}
          data-testid={`${testId}-plus`}
          onClick={() => onStep(1)}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
