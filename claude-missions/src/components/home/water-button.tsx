"use client";

import { Droplet, GlassWater, Milk, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Voda: a compact water button on `/danas` that opens the "Unesi vodu" sheet.
// The button itself stays a single slim row (it must not crowd the dashboard);
// tapping it opens a bottom sheet where the user taps a glass/bottle preset (or
// types an amount) and confirms with "Unesi".
//
// Same dependency-free overlay pattern as `WeighInSheet`
// (`src/components/analytics/weigh-in-sheet.tsx`): a fixed `bg-black/50`
// overlay, `role="dialog"`, and a small `idle | saving | error` status machine.
//
// The sheet composes a DELTA (the presets ADD to the shown amount, exactly like
// the reference), then POSTs that delta to `/api/voda`, which adds it to the
// day's running total server-side and returns the new total — the source of
// truth that this component then reflects.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo vodu. Pokušaj ponovo.";

/** Cap the amount a single "Unesi" can add (matches the DB/route bound). */
const MAX_ML = 20000;

/** Quick-add presets, in the reference's order (glass → bottle → large). */
const PRESETS: { ml: number; label: string; sub: string; icon: typeof GlassWater }[] = [
  { ml: 250, label: "+1 čaša", sub: "250 mL", icon: GlassWater },
  { ml: 500, label: "+1 flaša", sub: "500 mL", icon: Milk },
  { ml: 750, label: "+1 velika flaša", sub: "750 mL", icon: Milk },
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
}: {
  /** Belgrade calendar day (`"YYYY-MM-DD"`) this button logs water for. */
  dayKey: string;
  /** The day's already-logged water total (ml), read server-side. */
  initialMl?: number;
}) {
  const [totalMl, setTotalMl] = useState(initialMl);
  const [isOpen, setIsOpen] = useState(false);
  const [addMl, setAddMl] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
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

  function bump(ml: number) {
    setStatus("idle");
    setErrorMessage(undefined);
    setAddMl((current) => Math.min(MAX_ML, current + ml));
  }

  function onAmountChange(value: string) {
    setStatus("idle");
    setErrorMessage(undefined);
    const digits = value.replace(/\D/g, "").slice(0, 5);
    setAddMl(digits === "" ? 0 : Math.min(MAX_ML, Number(digits)));
  }

  async function onConfirm() {
    if (addMl <= 0) return;

    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch("/api/voda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: dayKey, deltaMl: addMl }),
      });
      const body = (await response.json()) as VodaResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || SAVE_FAILED_ERROR_SR);
        return;
      }

      setTotalMl(body.data.ml);
      setStatus("idle");
      setIsOpen(false);
    } catch {
      setStatus("error");
      setErrorMessage(SAVE_FAILED_ERROR_SR);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openSheet}
        data-testid="water-open-button"
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 active:translate-y-px"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Droplet className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold text-foreground">Voda</span>
        </span>
        <span className="flex items-center gap-2.5">
          <span
            data-testid="water-total"
            className="text-sm font-medium text-muted-foreground tabular-nums"
          >
            {formatWaterSr(totalMl)}
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </span>
      </button>

      {isOpen ? (
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
            className="flex w-full max-w-sm flex-col gap-7 rounded-t-3xl border border-border bg-card px-6 pb-8 pt-6 shadow-lg sm:rounded-3xl"
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

            {/* Big editable amount, like the reference: the presets add to it. */}
            <div className="flex items-baseline justify-center gap-1.5 py-2">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Količina vode u mililitrima"
                data-testid="water-amount-input"
                value={String(addMl)}
                onChange={(event) => onAmountChange(event.target.value)}
                size={Math.max(1, String(addMl).length)}
                className="min-w-0 border-0 bg-transparent p-0 text-center text-6xl font-bold text-foreground tabular-nums outline-none focus:outline-none"
              />
              <span className="text-2xl font-medium text-muted-foreground">
                mL
              </span>
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
                disabled={status === "saving" || addMl <= 0}
                data-testid="water-save-button"
                className="h-12 w-full text-base"
              >
                {status === "saving" ? "Čuvanje..." : "Unesi"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Uneseno: {formatWaterSr(totalMl)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
