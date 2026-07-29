"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeMacrosForGrams,
  resolveUnitGrams,
  type PortionFoodInput,
} from "@/lib/food/portions";
import type { Food, LogMethod } from "@/lib/types/db";

// F025 / AS-041 (grams -> macros), AS-042 (common unit -> macros): the
// portion picker shown after a food is selected from `/dodaj/pretraga`
// (F024). Either a raw grams entry OR a common-unit chip (with a quantity
// multiplier, e.g. "2 parčeta") drives a LIVE preview of the resulting
// kcal + macros, computed client-side with the exact same pure functions
// (`computeMacrosForGrams`, `resolveUnitGrams`, `src/lib/food/portions.ts`)
// the server re-runs when the confirm button actually saves -- so the
// preview the user sees is never a different calculation than what gets
// persisted (per the clarified "no partial writes" / money-math
// conventions, applied here as "no client/server number drift" too).
//
// Reusable shape note: this component only needs `food` (per-100g values +
// common_units) and posts a resolved `grams` number to `POST /api/logs` --
// F031 (barcode) and F062/F064 (photo) can render this same component once
// they have resolved a `Food` row, exactly like this screen does after a
// search-result tap.
//
// F031 / AS-054: added the optional `method` prop below so a caller other
// than the search flow (e.g. `src/components/scan/scan-screen.tsx` after a
// barcode lookup HIT) can tag the resulting `logs` row with its own
// `LogMethod` ('barcode') instead of always defaulting to 'search' --
// `POST /api/logs` (F025) already accepts an arbitrary `method` in its
// request body, this was the only missing wiring.

const DEFAULT_GRAMS = "100";
const MIN_QUANTITY = 0.5;
const MAX_QUANTITY = 20;
const QUANTITY_STEP = 0.5;

type PortionMode = "grams" | "unit";

interface CreateLogResponseBody {
  ok: boolean;
  error_sr?: string;
}

export function PortionPicker({
  food,
  afterSaveHref = "/danas",
  method = "search",
}: {
  food: Food;
  /** Where to send the user after a successful save -- defaults to the
   * home/today view (F027; may still be a placeholder route, per the
   * clarified "return the user toward home/today" scope answer). */
  afterSaveHref?: string;
  /** How this log entry was created -- defaults to 'search' (the
   * `/dodaj/pretraga` flow this component was originally built for).
   * F031 passes 'barcode' when rendering this after a scan lookup hit. */
  method?: LogMethod;
}) {
  const { t } = useT();
  const router = useRouter();
  const [mode, setMode] = useState<PortionMode>("grams");
  const [gramsInput, setGramsInput] = useState(DEFAULT_GRAMS);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(
    null
  );
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );

  const foodInput: PortionFoodInput = food;

  const resolvedGrams = useMemo(() => {
    if (mode === "unit" && selectedUnitIndex !== null) {
      const unit = food.common_units[selectedUnitIndex];
      if (!unit) return 0;
      return resolveUnitGrams(unit, quantity);
    }
    const parsed = Number.parseFloat(gramsInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [mode, selectedUnitIndex, quantity, gramsInput, food.common_units]);

  const preview = useMemo(
    () => computeMacrosForGrams(foodInput, resolvedGrams),
    [foodInput, resolvedGrams]
  );

  function selectUnit(index: number) {
    setMode("unit");
    setSelectedUnitIndex(index);
    setStatus("idle");
    setErrorMessage(undefined);
  }

  function onGramsChange(value: string) {
    setGramsInput(value);
    setMode("grams");
    setSelectedUnitIndex(null);
    setStatus("idle");
    setErrorMessage(undefined);
  }

  function onQuantityChange(value: string) {
    const parsed = Number.parseFloat(value);
    setQuantity(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    setStatus("idle");
    setErrorMessage(undefined);
  }

  const canConfirm = resolvedGrams > 0 && status !== "saving";

  async function onConfirm() {
    if (!canConfirm) {
      setStatus("error");
      setErrorMessage(t("food.portion.minGramsError"));
      return;
    }

    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          foodId: food.id,
          grams: resolvedGrams,
          method,
        }),
      });
      const body = (await response.json()) as CreateLogResponseBody;

      if (!response.ok || !body.ok) {
        setStatus("error");
        setErrorMessage(body.error_sr || t("food.portion.saveError"));
        return;
      }

      router.push(afterSaveHref);
    } catch {
      setStatus("error");
      setErrorMessage(t("food.portion.saveError"));
    }
  }

  return (
    <main
      data-testid="portion-picker"
      className="flex flex-1 flex-col gap-6 px-6 py-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {food.name_sr}
        </h1>
        {food.brand ? (
          <p className="text-sm text-muted-foreground">{food.brand}</p>
        ) : null}
      </div>

      {food.common_units.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>{t("food.portion.commonPortion")}</Label>
          <div
            className="flex flex-wrap gap-2"
            data-testid="portion-unit-chips"
          >
            {food.common_units.map((unit, index) => (
              <button
                key={`${unit.label}-${index}`}
                type="button"
                data-testid={`portion-unit-chip-${index}`}
                onClick={() => selectUnit(index)}
                aria-pressed={mode === "unit" && selectedUnitIndex === index}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "unit" && selectedUnitIndex === index
                    ? "liquid-glass border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {unit.label} ({unit.grams} g)
              </button>
            ))}
          </div>

          {mode === "unit" && selectedUnitIndex !== null ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="portion-quantity-input">
                {t("food.portion.quantity")}
              </Label>
              <Input
                id="portion-quantity-input"
                data-testid="portion-quantity-input"
                type="number"
                inputMode="decimal"
                min={MIN_QUANTITY}
                max={MAX_QUANTITY}
                step={QUANTITY_STEP}
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="portion-grams-input">
          {t("food.portion.gramsLabel")}
        </Label>
        <Input
          id="portion-grams-input"
          data-testid="portion-grams-input"
          type="number"
          inputMode="decimal"
          min={1}
          value={mode === "grams" ? gramsInput : String(resolvedGrams)}
          onChange={(event) => onGramsChange(event.target.value)}
        />
      </div>

      <div
        data-testid="portion-preview"
        className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-4"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {t("food.calories")}
          </span>
          <span
            data-testid="portion-preview-kcal"
            className="text-3xl font-bold text-foreground"
          >
            {Math.round(preview.kcal)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span data-testid="portion-preview-protein">
            {t("macro.protein")}: {preview.protein} g
          </span>
          <span data-testid="portion-preview-carbs">
            {t("macro.carbs")}: {preview.carbs} g
          </span>
          <span data-testid="portion-preview-fat">
            {t("macro.fat")}: {preview.fat} g
          </span>
        </div>
      </div>

      {status === "error" && errorMessage ? (
        <p
          role="alert"
          data-testid="portion-error"
          className="text-sm font-medium text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="button"
        data-testid="portion-confirm-button"
        onClick={onConfirm}
        disabled={!canConfirm}
        className="w-full"
      >
        {status === "saving"
          ? t("food.portion.saving")
          : t("food.portion.confirm")}
      </Button>
    </main>
  );
}
