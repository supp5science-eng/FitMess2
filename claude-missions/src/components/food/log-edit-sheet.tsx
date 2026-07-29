"use client";

import { useMemo, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeMacrosForGrams,
  findMatchingCommonUnit,
  resolveUnitGrams,
  type PortionFoodInput,
} from "@/lib/food/portions";
import type { Food, Log } from "@/lib/types/db";

// F026 / AS-044: the reusable "edit an existing log entry's portion" sheet.
// Reuses `src/lib/food/portions.ts`'s exact pure math F025's
// `PortionPicker` uses (`computeMacrosForGrams`, `resolveUnitGrams`,
// `findMatchingCommonUnit`) for the SAME live-preview-matches-what-gets-
// persisted guarantee -- the server (`PATCH /api/logs/[id]`) recomputes the
// same way from the food's live per-100g values, never trusting this
// preview number directly.
//
// A deliberately simple, dependency-free overlay (no shadcn Sheet/Dialog
// primitive exists in this codebase -- see `src/components/ui/`), same
// fixed-position-overlay + role="dialog" pattern F019's
// `DeleteAccountDialog` established, rather than a full-page route like
// F025's picker: an edit needs to be triggered CONTEXTUALLY from wherever a
// log entry is rendered (a meal card, F027), not navigated to.
//
// Self-contained trigger + open state (own "Izmeni" button) so F027 can drop
// `<LogEditSheet log={log} food={food} onSaved={...} />` directly onto a
// meal card without also having to manage open/close state itself --
// `onSaved` is the caller's hook to re-fetch/recompute the day's remaining
// budget after a successful edit (F026 itself only proves the log row
// changed correctly; the visual ring recompute is F027's job).

const MIN_QUANTITY = 0.5;
const MAX_QUANTITY = 20;
const QUANTITY_STEP = 0.5;

type PortionMode = "grams" | "unit";

interface UpdateLogResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: Log;
}

export function LogEditSheet({
  log,
  food,
  onSaved,
}: {
  /** The existing entry being edited -- only `id` and `grams` are read. */
  log: Pick<Log, "id" | "grams">;
  /** The food this entry references -- provides per-100g values +
   * common_units for the live preview / unit chips, pre-loaded exactly like
   * F025's picker. */
  food: Food;
  /** Called with the updated log row after a successful save, so the caller
   * can re-fetch/recompute the day's totals. */
  onSaved?: (updatedLog: Log) => void;
}) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const initialMatch = useMemo(
    () => findMatchingCommonUnit(food.common_units, log.grams),
    [food.common_units, log.grams]
  );
  const [mode, setMode] = useState<PortionMode>(
    initialMatch ? "unit" : "grams"
  );
  const [gramsInput, setGramsInput] = useState(String(log.grams));
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(
    initialMatch ? initialMatch.unitIndex : null
  );
  const [quantity, setQuantity] = useState(initialMatch ? initialMatch.quantity : 1);
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

  function resetToCurrentEntry() {
    const match = findMatchingCommonUnit(food.common_units, log.grams);
    setMode(match ? "unit" : "grams");
    setGramsInput(String(log.grams));
    setSelectedUnitIndex(match ? match.unitIndex : null);
    setQuantity(match ? match.quantity : 1);
    setStatus("idle");
    setErrorMessage(undefined);
  }

  function openSheet() {
    resetToCurrentEntry();
    setIsOpen(true);
  }

  function closeSheet() {
    if (status === "saving") return;
    setIsOpen(false);
  }

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
      const response = await fetch(`/api/logs/${log.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grams: resolvedGrams }),
      });
      const body = (await response.json()) as UpdateLogResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || t("food.logEdit.saveError"));
        return;
      }

      setStatus("idle");
      onSaved?.(body.data);
      setIsOpen(false);
    } catch {
      setStatus("error");
      setErrorMessage(t("food.logEdit.saveError"));
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={openSheet}
        data-testid="log-edit-open-button"
      >
        {t("food.logEdit.open")}
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
          data-testid="log-edit-sheet-overlay"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-edit-sheet-title"
            data-testid="log-edit-sheet"
            className="flex w-full max-w-sm flex-col gap-6 rounded-t-xl border border-border bg-background px-6 py-8 shadow-lg sm:rounded-xl"
          >
            <h2
              id="log-edit-sheet-title"
              className="text-lg font-semibold text-foreground"
            >
              {food.name_sr}
            </h2>

            {food.common_units.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>{t("food.portion.commonPortion")}</Label>
                <div
                  className="flex flex-wrap gap-2"
                  data-testid="log-edit-unit-chips"
                >
                  {food.common_units.map((unit, index) => (
                    <button
                      key={`${unit.label}-${index}`}
                      type="button"
                      data-testid={`log-edit-unit-chip-${index}`}
                      onClick={() => selectUnit(index)}
                      aria-pressed={
                        mode === "unit" && selectedUnitIndex === index
                      }
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
                    <Label htmlFor="log-edit-quantity-input">
                      {t("food.portion.quantity")}
                    </Label>
                    <Input
                      id="log-edit-quantity-input"
                      data-testid="log-edit-quantity-input"
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
              <Label htmlFor="log-edit-grams-input">
                {t("food.portion.gramsLabel")}
              </Label>
              <Input
                id="log-edit-grams-input"
                data-testid="log-edit-grams-input"
                type="number"
                inputMode="decimal"
                min={1}
                value={mode === "grams" ? gramsInput : String(resolvedGrams)}
                onChange={(event) => onGramsChange(event.target.value)}
              />
            </div>

            <div
              data-testid="log-edit-preview"
              className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("food.calories")}
                </span>
                <span
                  data-testid="log-edit-preview-kcal"
                  className="text-3xl font-bold text-foreground"
                >
                  {Math.round(preview.kcal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span data-testid="log-edit-preview-protein">
                  {t("macro.protein")}: {preview.protein} g
                </span>
                <span data-testid="log-edit-preview-carbs">
                  {t("macro.carbs")}: {preview.carbs} g
                </span>
                <span data-testid="log-edit-preview-fat">
                  {t("macro.fat")}: {preview.fat} g
                </span>
              </div>
            </div>

            {status === "error" && errorMessage ? (
              <p
                role="alert"
                data-testid="log-edit-error"
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
                data-testid="log-edit-cancel-button"
              >
                {t("food.cancel")}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                data-testid="log-edit-save-button"
              >
                {status === "saving"
                  ? t("food.portion.saving")
                  : t("food.logEdit.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
