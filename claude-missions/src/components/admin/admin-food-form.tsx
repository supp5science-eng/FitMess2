"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminFoodInputSchema } from "@/lib/food/admin-foods";
import type { Food } from "@/lib/types/db";

// F035 / AS-061 + AS-064: the admin food editor form, shared by the two admin
// pages -- `/admin/hrana/novi` (create, marked verified on save) and
// `/admin/hrana/[id]` (edit an existing food). Unlike the crowd-sourced
// `NewProductForm` (which hands off to the portion picker so a user can log
// what they just created), this one is a pure admin CRUD form: it also edits
// `common_units` (named portions) and, on create, does NOT log anything -- it
// just seeds the catalog and returns to the queue, or clears itself for the
// next scan (the PRD Addendum-1 rapid manual-seeding workflow).

const DECIMAL = "decimal" as const;

type Status = "idle" | "saving" | "error" | "saved";

interface CommonUnitRow {
  label: string;
  grams: string;
}

interface AdminFoodResponse {
  ok: boolean;
  data?: Food;
  error_sr?: string;
  existingFoodId?: string;
}

function toRows(food: Food | undefined): CommonUnitRow[] {
  if (!food || food.common_units.length === 0) return [];
  return food.common_units.map((unit) => ({
    label: unit.label,
    grams: String(unit.grams),
  }));
}

export function AdminFoodForm({
  mode,
  food,
  initialBarcode,
}: {
  mode: "create" | "edit";
  /** The food being edited (edit mode only). */
  food?: Food;
  /** Pre-fills the barcode on create (e.g. scan-to-create with a decoded GTIN). */
  initialBarcode?: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(food?.name_sr ?? "");
  const [brand, setBrand] = useState(food?.brand ?? "");
  const [barcode, setBarcode] = useState(food?.barcode ?? initialBarcode ?? "");
  const [kcal, setKcal] = useState(food ? String(food.kcal_100g) : "");
  const [protein, setProtein] = useState(food ? String(food.protein_100g) : "");
  const [carbs, setCarbs] = useState(food ? String(food.carbs_100g) : "");
  const [fat, setFat] = useState(food ? String(food.fat_100g) : "");
  const [units, setUnits] = useState<CommonUnitRow[]>(toRows(food));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [existingFoodId, setExistingFoodId] = useState<string | undefined>();

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateUnit(index: number, patch: Partial<CommonUnitRow>) {
    setUnits((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addUnit() {
    setUnits((current) => [...current, { label: "", grams: "" }]);
  }

  function removeUnit(index: number) {
    setUnits((current) => current.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Drop fully-empty common-unit rows; keep partial ones so their error shows.
    const enteredUnits = units.filter(
      (u) => u.label.trim() !== "" || u.grams.trim() !== ""
    );

    const candidate = {
      name_sr: name,
      brand,
      barcode,
      kcal_100g: Number.parseFloat(kcal),
      protein_100g: Number.parseFloat(protein),
      carbs_100g: Number.parseFloat(carbs),
      fat_100g: Number.parseFloat(fat),
      common_units: enteredUnits.map((u) => ({
        label: u.label,
        grams: Number.parseFloat(u.grams),
      })),
    };

    const parsed = adminFoodInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      setStatus("error");
      setErrorMessage(undefined);
      setExistingFoodId(undefined);
      return;
    }

    setFieldErrors({});
    setStatus("saving");
    setErrorMessage(undefined);
    setExistingFoodId(undefined);

    const url =
      mode === "create" ? "/api/admin/foods" : `/api/admin/foods/${food!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as AdminFoodResponse;

      if (!response.ok || !body.ok || !body.data) {
        setStatus("error");
        setErrorMessage(body.error_sr || "Nešto je pošlo naopako.");
        setExistingFoodId(body.existingFoodId);
        return;
      }

      if (mode === "edit") {
        router.push("/admin/hrana");
        router.refresh();
        return;
      }

      // Create: stay on the page and clear it, so the admin can seed the next
      // product immediately (rapid manual-seeding workflow).
      setStatus("saved");
      setName("");
      setBrand("");
      setBarcode("");
      setKcal("");
      setProtein("");
      setCarbs("");
      setFat("");
      setUnits([]);
    } catch {
      setStatus("error");
      setErrorMessage("Nešto je pošlo naopako. Pokušaj ponovo.");
    }
  }

  const isDuplicate = Boolean(existingFoodId) && Boolean(errorMessage);

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <Field
        id="admin-food-name"
        label="Naziv namirnice"
        value={name}
        onChange={(v) => {
          setName(v);
          clearFieldError("name_sr");
        }}
        error={fieldErrors.name_sr}
        placeholder="Npr. Jogurt 2.8% m.m."
        required
      />
      <Field
        id="admin-food-brand"
        label="Brend (opciono)"
        value={brand}
        onChange={(v) => {
          setBrand(v);
          clearFieldError("brand");
        }}
        error={fieldErrors.brand}
        placeholder="Npr. Imlek"
      />
      <Field
        id="admin-food-barcode"
        label="Barkod (opciono)"
        value={barcode}
        onChange={(v) => {
          setBarcode(v);
          clearFieldError("barcode");
        }}
        error={fieldErrors.barcode}
        placeholder="Npr. 8600000000000"
        inputMode="numeric"
      />

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Vrednosti na 100g</h2>
        <p className="text-xs text-muted-foreground">
          Unesi tačne vrednosti sa deklaracije, po 100 grama.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="admin-food-kcal"
          label="Kalorije (kcal)"
          value={kcal}
          onChange={(v) => {
            setKcal(v);
            clearFieldError("kcal_100g");
          }}
          error={fieldErrors.kcal_100g}
          type="number"
          inputMode={DECIMAL}
          required
        />
        <Field
          id="admin-food-protein"
          label="Proteini (g)"
          value={protein}
          onChange={(v) => {
            setProtein(v);
            clearFieldError("protein_100g");
          }}
          error={fieldErrors.protein_100g}
          type="number"
          inputMode={DECIMAL}
          required
        />
        <Field
          id="admin-food-carbs"
          label="Ugljeni hidrati (g)"
          value={carbs}
          onChange={(v) => {
            setCarbs(v);
            clearFieldError("carbs_100g");
          }}
          error={fieldErrors.carbs_100g}
          type="number"
          inputMode={DECIMAL}
          required
        />
        <Field
          id="admin-food-fat"
          label="Masti (g)"
          value={fat}
          onChange={(v) => {
            setFat(v);
            clearFieldError("fat_100g");
          }}
          error={fieldErrors.fat_100g}
          type="number"
          inputMode={DECIMAL}
          required
        />
      </div>

      {/* common_units editor: named portions (e.g. "1 kriška" = 30g). */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            Mere porcije (opciono)
          </h2>
          <p className="text-xs text-muted-foreground">
            Npr. 1 kriška = 30g, 1 šolja = 240g. Olakšava logovanje porcija.
          </p>
        </div>
        {units.map((row, index) => {
          const labelErr = fieldErrors[`common_units.${index}.label`];
          const gramsErr = fieldErrors[`common_units.${index}.grams`];
          return (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  aria-label={`Naziv mere ${index + 1}`}
                  value={row.label}
                  onChange={(e) => updateUnit(index, { label: e.target.value })}
                  placeholder="Naziv (npr. kriška)"
                  aria-invalid={Boolean(labelErr)}
                />
                {labelErr ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {labelErr}
                  </p>
                ) : null}
              </div>
              <div className="w-28">
                <Input
                  aria-label={`Grami mere ${index + 1}`}
                  value={row.grams}
                  onChange={(e) => updateUnit(index, { grams: e.target.value })}
                  placeholder="grama"
                  type="number"
                  inputMode={DECIMAL}
                  aria-invalid={Boolean(gramsErr)}
                />
                {gramsErr ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {gramsErr}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Obriši meru ${index + 1}`}
                onClick={() => removeUnit(index)}
              >
                ✕
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addUnit}
          className="self-start"
        >
          + Dodaj meru
        </Button>
      </div>

      {status === "error" && errorMessage ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorMessage}
          </p>
          {isDuplicate && existingFoodId ? (
            <Link
              href={`/admin/hrana/${existingFoodId}`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Otvori postojeći proizvod
            </Link>
          ) : null}
        </div>
      ) : null}

      {status === "saved" ? (
        <p
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
        >
          Sačuvano ✓ Forma je ispražnjena za sledeći proizvod.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={status === "saving"}
          className="flex-1"
        >
          {status === "saving"
            ? "Čuvanje..."
            : mode === "create"
              ? "Sačuvaj (provereno)"
              : "Sačuvaj izmene"}
        </Button>
        <Link
          href="/admin/hrana"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Nazad
        </Link>
      </div>
    </form>
  );
}

function Field({
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
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
