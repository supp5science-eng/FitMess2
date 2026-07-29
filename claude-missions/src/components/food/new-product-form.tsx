"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, Upload } from "lucide-react";

import { PortionPicker } from "@/components/food/portion-picker";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newFoodEntrySchema } from "@/lib/food/create";
import { downscaleImage } from "@/lib/image/downscale";
import type { LabelEstimate } from "@/lib/ai/label-estimate";
import type { Food } from "@/lib/types/db";

// F032 / AS-055 (a barcode miss offers a first-time entry form pre-filled
// with the scanned GTIN), AS-056 (the saved product is immediately
// findable by every user via both barcode scan and text search, marked
// "neprovereno"), AS-057 (a duplicate barcode is rejected with a friendly
// Serbian message, never a crash): the first-time product entry form shown
// at `/dodaj/novi-proizvod` (`src/app/(app)/dodaj/novi-proizvod/page.tsx`)
// after `ScanScreen` (F031) routes here on a barcode-lookup MISS.
//
// It is ALSO the confirm/edit step of the dedicated "Dodaj proizvod" flow
// (`src/app/(app)/dodaj/proizvod/`), which pre-fills the barcode from a scan
// OR an uploaded photo and asks for a reference price. Two optional-prop
// seams keep that reuse clean instead of forking the form:
//   * `enableLabelCapture` + `estimateLabel` -> render an inline "fill from a
//     photographed nutrition label" affordance (camera OR gallery upload) that
//     runs the same Gemini `estimateLabelAction` the standalone
//     `/dodaj/deklaracija` flow uses, writing its per-100g result straight into
//     this form's fields (still fully editable -- a prefill, never a lock).
//   * `onCreated` -> after a successful save, hand the created `Food` back to
//     the caller (the "Dodaj proizvod" flow shows a success animation) instead
//     of this form's own default of swapping in the reused `PortionPicker`.
//
// "Server as source of truth; small client state (form/optimistic) only"
// (clarified state-location answer): the only server-fetched prop is the
// scanned GTIN itself (`initialBarcode`); everything else here is transient
// form state until `POST /api/foods` (F032) persists it.

const DECIMAL_INPUT_MODE = "decimal" as const;

type FormStatus = "idle" | "saving" | "error";
type LabelPhase = "idle" | "reading";

/** The shape `estimateLabel` (a Gemini-backed server action) resolves to --
 * mirrors `LabelResult` in `src/app/(app)/dodaj/proizvod/actions.ts` without
 * importing a server-action module into this client component. */
export type LabelEstimateResult =
  | { ok: true; data: LabelEstimate }
  | { ok: false; error_sr: string };

interface CreateFoodResponseBody {
  ok: boolean;
  data?: Food;
  error_sr?: string;
  existingFoodId?: string;
}

// Number -> a clean string for a prefilled field (drop a trailing ".0").
function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function NewProductForm({
  initialBarcode,
  initialName,
  initialBrand,
  initialKcal,
  initialProtein,
  initialCarbs,
  initialFat,
  initialPrice,
  enableLabelCapture = false,
  estimateLabel,
  onCreated,
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
  /** Optional reference price (RSD) prefill. */
  initialPrice?: string;
  /** When true (and `estimateLabel` is provided), renders the inline
   * "fill from a photographed nutrition label" affordance. */
  enableLabelCapture?: boolean;
  /** Gemini-backed server action that reads a nutrition label and returns
   * per-100g values -- wired by the caller so this client component never
   * imports a server-action module directly. */
  estimateLabel?: (formData: FormData) => Promise<LabelEstimateResult>;
  /** When provided, called with the created food after a successful save
   * instead of swapping in the portion picker (the "Dodaj proizvod" flow
   * uses this to show its own success screen). */
  onCreated?: (food: Food) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(initialName ?? "");
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [barcode, setBarcode] = useState(initialBarcode ?? "");
  const [price, setPrice] = useState(initialPrice ?? "");
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

  const [labelPhase, setLabelPhase] = useState<LabelPhase>("idle");
  const [labelError, setLabelError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Once saved, hand off straight to the (reused, unmodified) portion
  // picker so the user can log it immediately -- never a dead end after
  // "save." (Skipped entirely when `onCreated` owns the post-save UX.)
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

  async function handleLabelPhoto(file: File) {
    if (!estimateLabel) return;
    setLabelError(null);
    setLabelPhase("reading");
    try {
      const blob = await downscaleImage(file);
      const formData = new FormData();
      formData.append("slika", blob, "deklaracija.jpg");

      const result = await estimateLabel(formData);
      if (!result.ok) {
        setLabelError(result.error_sr);
        setLabelPhase("idle");
        return;
      }

      // Write the extracted per-100g values into the (still-editable) form.
      const est = result.data;
      if (est.naziv) setName(est.naziv);
      if (est.brend) setBrand(est.brend);
      setKcal(num(est.kcal_100g));
      setProtein(num(est.protein_100g));
      setCarbs(num(est.uh_100g));
      setFat(num(est.mast_100g));
      setFieldErrors({});
      setStatus("idle");
      setLabelPhase("idle");
    } catch {
      setLabelError(t("food.labelReadFailed"));
      setLabelPhase("idle");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const candidate: Record<string, unknown> = {
      name_sr: name,
      brand,
      barcode,
      kcal_100g: Number.parseFloat(kcal),
      protein_100g: Number.parseFloat(protein),
      carbs_100g: Number.parseFloat(carbs),
      fat_100g: Number.parseFloat(fat),
    };
    // Price is optional: only include it when the user typed something, so an
    // empty field stays "not provided" (undefined) rather than NaN.
    if (price.trim() !== "") {
      candidate.price = Number.parseFloat(price);
    }

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
        setErrorMessage(body.error_sr || t("food.createFailed"));
        setExistingFoodId(body.existingFoodId);
        return;
      }

      setStatus("idle");
      if (onCreated) {
        onCreated(body.data);
        return;
      }
      setCreatedFood(body.data);
    } catch {
      setStatus("error");
      setErrorMessage(t("food.createFailed"));
    }
  }

  const isDuplicateBarcodeError =
    status === "error" && Boolean(existingFoodId) && Boolean(errorMessage);

  const showLabelCapture = enableLabelCapture && Boolean(estimateLabel);

  return (
    <form
      data-testid="novi-proizvod-form"
      onSubmit={onSubmit}
      className="flex flex-1 flex-col gap-5"
      noValidate
    >
      {showLabelCapture ? (
        <div
          data-testid="novi-proizvod-label-capture"
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-4"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              {t("food.fillFromLabel")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("food.fillFromLabelHint")}
            </p>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            data-testid="novi-proizvod-label-camera-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleLabelPhoto(file);
              event.target.value = "";
            }}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid="novi-proizvod-label-upload-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleLabelPhoto(file);
              event.target.value = "";
            }}
          />

          {labelPhase === "reading" ? (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="novi-proizvod-label-reading"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>{t("food.readingLabel")}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                data-testid="novi-proizvod-label-camera-button"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera aria-hidden="true" />
                {t("food.takePhoto")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                data-testid="novi-proizvod-label-upload-button"
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {t("food.upload")}
              </Button>
            </div>
          )}

          {labelError ? (
            <p
              role="alert"
              data-testid="novi-proizvod-label-error"
              className="text-xs font-medium text-destructive"
            >
              {labelError}
            </p>
          ) : null}
        </div>
      ) : null}

      <FormField
        id="novi-proizvod-name-input"
        label={t("food.nameLabel")}
        value={name}
        onChange={(value) => {
          setName(value);
          clearFieldError("name_sr");
        }}
        error={fieldErrors.name_sr}
        placeholder={t("food.namePlaceholder")}
        required
      />

      <FormField
        id="novi-proizvod-brand-input"
        label={t("food.brandLabel")}
        value={brand}
        onChange={(value) => {
          setBrand(value);
          clearFieldError("brand");
        }}
        error={fieldErrors.brand}
        placeholder={t("food.brandPlaceholder")}
      />

      <FormField
        id="novi-proizvod-barcode-input"
        label={t("food.barcodeLabel")}
        value={barcode}
        onChange={(value) => {
          setBarcode(value);
          clearFieldError("barcode");
        }}
        error={fieldErrors.barcode}
        placeholder={t("food.barcodePlaceholder")}
        inputMode="numeric"
      />

      <FormField
        id="novi-proizvod-price-input"
        label={t("food.priceLabel")}
        value={price}
        onChange={(value) => {
          setPrice(value);
          clearFieldError("price");
        }}
        error={fieldErrors.price}
        placeholder={t("food.pricePlaceholder")}
        type="number"
        inputMode={DECIMAL_INPUT_MODE}
      />

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          {t("food.valuesPer100g")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("food.valuesPer100gHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          id="novi-proizvod-kcal-input"
          label={t("food.kcalLabel")}
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
          label={t("food.proteinLabel")}
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
          label={t("food.carbsLabel")}
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
          label={t("food.fatLabel")}
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
              {t("food.openExisting")}
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
        {status === "saving" ? t("food.saving") : t("food.saveProduct")}
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
