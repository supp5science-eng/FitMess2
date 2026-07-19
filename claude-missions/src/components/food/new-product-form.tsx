"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PortionPicker } from "@/components/food/portion-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FOOD_CREATE_FAILED_ERROR_SR,
  newFoodEntrySchema,
} from "@/lib/food/create";
import type { Food } from "@/lib/types/db";

// F032 / AS-055 (a barcode miss offers a first-time entry form pre-filled
// with the scanned GTIN), AS-056 (the saved product is immediately
// findable by every user via both barcode scan and text search, marked
// "neprovereno"), AS-057 (a duplicate barcode is rejected with a friendly
// Serbian message, never a crash): the first-time product entry form shown
// at `/dodaj/novi-proizvod` (`src/app/(app)/dodaj/novi-proizvod/page.tsx`)
// after `ScanScreen` (F031) routes here on a barcode-lookup MISS.
//
// "Server as source of truth; small client state (form/optimistic) only"
// (clarified state-location answer): the only server-fetched prop is the
// scanned GTIN itself (`initialBarcode`, read from the URL by the server
// component page); everything else here is transient form state until
// `POST /api/foods` (F032) persists it.
//
// On a successful save, this component swaps itself for the REUSED,
// unmodified F025 `PortionPicker` (same reuse pattern F031's `ScanScreen`
// established) so the user can log the just-created product right away,
// tagging the resulting `logs` row `method: 'barcode'` when a barcode was
// attached, `'search'` otherwise (there is no dedicated `LogMethod` for
// "just created" -- 'barcode'/'search' both already exist and best
// describe how the food was FOUND for this log entry).
//
// M7 note (see this feature's own handoff): F063 will add a label-photo
// prefill step BEFORE this form renders (auto-filling name/brand/macros
// from a photographed nutrition label) -- this component itself remains
// the confirm/edit step either way, so F063 should pass its own prefilled
// values in as new optional initial-value props here rather than
// duplicating this form.

const DECIMAL_INPUT_MODE = "decimal" as const;

type FormStatus = "idle" | "saving" | "error";

interface CreateFoodResponseBody {
  ok: boolean;
  data?: Food;
  error_sr?: string;
  existingFoodId?: string;
}

export function NewProductForm({
  initialBarcode,
  initialName,
  initialBrand,
  initialKcal,
  initialProtein,
  initialCarbs,
  initialFat,
}: {
  /** The scanned GTIN from `ScanScreen`'s MISS redirect, when present
   * (`searchParams.barkod` on the server page) -- pre-fills, but does NOT
   * lock, the barcode field (per the clarified "read-only or editable
   * barcode field" answer: editable, so a direct/bookmarked visit with no
   * scan can still attach a barcode manually, and a mis-scanned digit can
   * be corrected before saving). */
  initialBarcode?: string;
  /** F063: values read off a photographed nutrition label (Gemini), passed
   * via the URL by the server page. All optional -- every field stays fully
   * editable; this is a prefill, never a lock. */
  initialName?: string;
  initialBrand?: string;
  initialKcal?: string;
  initialProtein?: string;
  initialCarbs?: string;
  initialFat?: string;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [barcode, setBarcode] = useState(initialBarcode ?? "");
  const [kcal, setKcal] = useState(initialKcal ?? "");
  const [protein, setProtein] = useState(initialProtein ?? "");
  const [carbs, setCarbs] = useState(initialCarbs ?? "");
  const [fat, setFat] = useState(initialFat ?? "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );
  const [existingFoodId, setExistingFoodId] = useState<string | undefined>(
    undefined
  );
  const [createdFood, setCreatedFood] = useState<Food | null>(null);

  // Once saved, hand off straight to the (reused, unmodified) portion
  // picker so the user can log it immediately -- never a dead end after
  // "save."
  if (createdFood) {
    return (
      <PortionPicker
        food={createdFood}
        method={createdFood.barcode ? "barcode" : "search"}
      />
    );
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const candidate = {
      name_sr: name,
      brand,
      barcode,
      kcal_100g: Number.parseFloat(kcal),
      protein_100g: Number.parseFloat(protein),
      carbs_100g: Number.parseFloat(carbs),
      fat_100g: Number.parseFloat(fat),
    };

    const parsed = newFoodEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      const nextFieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextFieldErrors[key]) {
          nextFieldErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setStatus("error");
      setErrorMessage(undefined);
      setExistingFoodId(undefined);
      return;
    }

    setFieldErrors({});
    setStatus("saving");
    setErrorMessage(undefined);
    setExistingFoodId(undefined);

    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as CreateFoodResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || FOOD_CREATE_FAILED_ERROR_SR);
        setExistingFoodId(body.existingFoodId);
        return;
      }

      setStatus("idle");
      setCreatedFood(body.data);
    } catch {
      setStatus("error");
      setErrorMessage(FOOD_CREATE_FAILED_ERROR_SR);
    }
  }

  const isDuplicateBarcodeError =
    status === "error" && Boolean(existingFoodId) && Boolean(errorMessage);

  return (
    <form
      data-testid="novi-proizvod-form"
      onSubmit={onSubmit}
      className="flex flex-1 flex-col gap-5"
      noValidate
    >
      <FormField
        id="novi-proizvod-name-input"
        label="Naziv namirnice"
        value={name}
        onChange={(value) => {
          setName(value);
          clearFieldError("name_sr");
        }}
        error={fieldErrors.name_sr}
        placeholder="Npr. Domaći ajvar"
        required
      />

      <FormField
        id="novi-proizvod-brand-input"
        label="Brend (opciono)"
        value={brand}
        onChange={(value) => {
          setBrand(value);
          clearFieldError("brand");
        }}
        error={fieldErrors.brand}
        placeholder="Npr. Podravka"
      />

      <FormField
        id="novi-proizvod-barcode-input"
        label="Barkod (opciono)"
        value={barcode}
        onChange={(value) => {
          setBarcode(value);
          clearFieldError("barcode");
        }}
        error={fieldErrors.barcode}
        placeholder="Npr. 5901234123457"
        inputMode="numeric"
      />

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          Vrednosti na 100g
        </h2>
        <p className="text-xs text-muted-foreground">
          Unesi vrednosti sa deklaracije proizvoda, po 100 grama.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="novi-proizvod-kcal-input"
          label="Kalorije (kcal)"
          value={kcal}
          onChange={(value) => {
            setKcal(value);
            clearFieldError("kcal_100g");
          }}
          error={fieldErrors.kcal_100g}
          type="number"
          inputMode={DECIMAL_INPUT_MODE}
          required
        />
        <FormField
          id="novi-proizvod-protein-input"
          label="Proteini (g)"
          value={protein}
          onChange={(value) => {
            setProtein(value);
            clearFieldError("protein_100g");
          }}
          error={fieldErrors.protein_100g}
          type="number"
          inputMode={DECIMAL_INPUT_MODE}
          required
        />
        <FormField
          id="novi-proizvod-carbs-input"
          label="Ugljeni hidrati (g)"
          value={carbs}
          onChange={(value) => {
            setCarbs(value);
            clearFieldError("carbs_100g");
          }}
          error={fieldErrors.carbs_100g}
          type="number"
          inputMode={DECIMAL_INPUT_MODE}
          required
        />
        <FormField
          id="novi-proizvod-fat-input"
          label="Masti (g)"
          value={fat}
          onChange={(value) => {
            setFat(value);
            clearFieldError("fat_100g");
          }}
          error={fieldErrors.fat_100g}
          type="number"
          inputMode={DECIMAL_INPUT_MODE}
          required
        />
      </div>

      {status === "error" && errorMessage ? (
        <div
          className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4"
          data-testid={
            isDuplicateBarcodeError
              ? "novi-proizvod-duplicate-error"
              : "novi-proizvod-error"
          }
        >
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorMessage}
          </p>
          {isDuplicateBarcodeError && existingFoodId ? (
            <Link
              href={`/dodaj/porcija/${existingFoodId}`}
              data-testid="novi-proizvod-open-existing"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Otvori postojeći proizvod
            </Link>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        data-testid="novi-proizvod-submit-button"
        disabled={status === "saving"}
        className="w-full"
      >
        {status === "saving" ? "Čuvanje..." : "Sačuvaj proizvod"}
      </Button>
    </form>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  inputMode,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal";
  required?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        data-testid={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          data-testid={`${id}-error`}
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
