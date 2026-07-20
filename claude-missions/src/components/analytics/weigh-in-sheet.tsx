"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// F042 / AS-072, AS-073: the "Upiši težinu" sheet on `/analitika`. Records
// TODAY's weight (the server assigns the Belgrade day and upserts, so a
// same-day re-weigh replaces the earlier value -- this UI never sends a day).
//
// Same dependency-free overlay pattern as `LogEditSheet` (`src/components/
// food/log-edit-sheet.tsx`): a self-contained trigger + open state, a fixed
// `bg-black/50` overlay, `role="dialog"`, `Button`/`Input`/`Label` from
// `ui/`, and a small `idle | saving | error` status machine -- no shadcn
// Dialog/Sheet primitive exists in this codebase.
//
// The server is the source of truth: on a successful save this calls
// `router.refresh()` so the `/analitika` server component re-fetches the
// weigh-ins and re-renders the trend, rather than this client mutating any
// local chart state.

const SAVE_FAILED_ERROR_SR = "Nismo uspeli da sačuvamo težinu. Pokušaj ponovo.";
const INVALID_WEIGHT_ERROR_SR = "Unesi težinu između 30 i 300 kg.";
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

interface WeighInResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: { id: string; day: string; weight_kg: number };
}

export function WeighInSheet({
  lastWeightKg,
}: {
  /** Latest known weight (kg) to prefill the input -- the most recent
   * weigh-in, or the onboarding `profiles.weight_kg` as a fallback. */
  lastWeightKg?: number | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [weightInput, setWeightInput] = useState(
    lastWeightKg != null ? String(lastWeightKg) : ""
  );
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );

  function openSheet() {
    setWeightInput(lastWeightKg != null ? String(lastWeightKg) : "");
    setStatus("idle");
    setErrorMessage(undefined);
    setIsOpen(true);
  }

  function closeSheet() {
    if (status === "saving") return;
    setIsOpen(false);
  }

  function onWeightChange(value: string) {
    setWeightInput(value);
    setStatus("idle");
    setErrorMessage(undefined);
  }

  async function onConfirm() {
    const parsed = Number.parseFloat(weightInput);
    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_WEIGHT_KG ||
      parsed > MAX_WEIGHT_KG
    ) {
      setStatus("error");
      setErrorMessage(INVALID_WEIGHT_ERROR_SR);
      return;
    }

    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch("/api/weigh-ins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weightKg: parsed }),
      });
      const body = (await response.json()) as WeighInResponseBody;

      if (!response.ok || !body.ok) {
        setStatus("error");
        setErrorMessage(body.error_sr || SAVE_FAILED_ERROR_SR);
        return;
      }

      setStatus("idle");
      setIsOpen(false);
      // Server is the source of truth -- re-fetch so the chart updates.
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage(SAVE_FAILED_ERROR_SR);
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={openSheet}
        data-testid="weigh-in-open-button"
      >
        Upiši težinu
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
          data-testid="weigh-in-sheet-overlay"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="weigh-in-sheet-title"
            data-testid="weigh-in-sheet"
            className="flex w-full max-w-sm flex-col gap-6 rounded-t-xl border border-border bg-card px-6 py-8 shadow-lg sm:rounded-xl"
          >
            <div className="flex flex-col gap-1">
              <h2
                id="weigh-in-sheet-title"
                className="text-lg font-semibold text-foreground"
              >
                Upiši današnju težinu
              </h2>
              <p className="text-sm text-muted-foreground">
                Najbolje ujutru, na prazan stomak — tako je merenje najstabilnije.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="weigh-in-input">Težina (kg)</Label>
              <Input
                id="weigh-in-input"
                data-testid="weigh-in-input"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={MIN_WEIGHT_KG}
                max={MAX_WEIGHT_KG}
                autoFocus
                value={weightInput}
                onChange={(event) => onWeightChange(event.target.value)}
              />
            </div>

            {status === "error" && errorMessage ? (
              <p
                role="alert"
                data-testid="weigh-in-error"
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
                data-testid="weigh-in-cancel-button"
              >
                Otkaži
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={status === "saving"}
                data-testid="weigh-in-save-button"
              >
                {status === "saving" ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
