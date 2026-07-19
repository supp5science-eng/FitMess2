"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Loader2, Sparkles } from "lucide-react";

import type { MealEstimate } from "@/lib/ai/meal-estimate";
import { estimateMealAction, logMealAction } from "./actions";

type Phase = "capture" | "estimating" | "confirm" | "saving";

interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const CONFIDENCE_LABEL: Record<MealEstimate["sigurnost"], string> = {
  niska: "Niska sigurnost",
  srednja: "Srednja sigurnost",
  visoka: "Visoka sigurnost",
};

// Downscale + re-encode the picked photo before upload -- faster, cheaper, and
// well within Gemini's needs. Falls back to the original file if anything odd
// happens with the canvas path.
async function downscale(file: File, maxDim = 1280, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        "image/jpeg",
        quality
      )
    );
  } catch {
    return file;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function ObrokFlow() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  // Per-100g reference derived from the AI estimate, so editing grams rescales
  // the macros the same way the portion picker does.
  const [per100, setPer100] = useState<Nutrition | null>(null);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState(0);
  const [nutrition, setNutrition] = useState<Nutrition>({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  async function handlePhoto(file: File) {
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhase("estimating");

    const blob = await downscale(file);
    const formData = new FormData();
    formData.append("slika", blob, "obrok.jpg");

    const result = await estimateMealAction(formData);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("capture");
      return;
    }

    const est = result.data;
    const g = est.procenjeni_grami;
    setEstimate(est);
    setPer100({
      kcal: (est.kcal / g) * 100,
      protein: (est.protein_g / g) * 100,
      carbs: (est.uh_g / g) * 100,
      fat: (est.mast_g / g) * 100,
    });
    setName(est.naziv);
    setGrams(Math.round(g));
    setNutrition({
      kcal: est.kcal,
      protein: est.protein_g,
      carbs: est.uh_g,
      fat: est.mast_g,
    });
    setPhase("confirm");
  }

  // Changing grams recomputes every macro from the AI's per-100g ratio.
  function handleGramsChange(value: number) {
    setGrams(value);
    if (!per100) return;
    setNutrition({
      kcal: (per100.kcal * value) / 100,
      protein: (per100.protein * value) / 100,
      carbs: (per100.carbs * value) / 100,
      fat: (per100.fat * value) / 100,
    });
  }

  async function handleSave() {
    setError(null);
    setPhase("saving");
    const result = await logMealAction({
      name,
      grams,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
    });
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("confirm");
      return;
    }
    router.push("/danas");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Slikaj obrok
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Otkaži
        </Link>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handlePhoto(file);
          event.target.value = "";
        }}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Tvoj obrok"
          className="max-h-64 w-full rounded-2xl object-cover"
        />
      ) : null}

      {phase === "capture" ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center transition-colors hover:bg-muted"
        >
          <Camera className="size-9 text-primary" aria-hidden="true" />
          <span className="text-base font-medium text-foreground">
            Slikaj ili izaberi fotografiju obroka
          </span>
          <span className="text-sm text-muted-foreground">
            AI će proceniti kalorije i makronutrijente
          </span>
        </button>
      ) : null}

      {phase === "estimating" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Analiziram obrok…</p>
        </div>
      ) : null}

      {(phase === "confirm" || phase === "saving") && estimate ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{CONFIDENCE_LABEL[estimate.sigurnost]}</span>
          </div>

          {estimate.sastojci.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {estimate.sastojci.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Naziv</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Gramaža (g)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={grams === 0 ? "" : grams}
              onChange={(event) =>
                handleGramsChange(Math.max(0, Number(event.target.value) || 0))
              }
              className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <MacroField
              label="Kalorije"
              value={nutrition.kcal}
              decimals={0}
              onChange={(v) => setNutrition((n) => ({ ...n, kcal: v }))}
            />
            <MacroField
              label="Protein (g)"
              value={nutrition.protein}
              onChange={(v) => setNutrition((n) => ({ ...n, protein: v }))}
            />
            <MacroField
              label="Ugljeni hidrati (g)"
              value={nutrition.carbs}
              onChange={(v) => setNutrition((n) => ({ ...n, carbs: v }))}
            />
            <MacroField
              label="Masti (g)"
              value={nutrition.fat}
              onChange={(v) => setNutrition((n) => ({ ...n, fat: v }))}
            />
          </div>

          {estimate.napomena ? (
            <p className="text-xs text-muted-foreground">{estimate.napomena}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={phase === "saving" || !name.trim() || grams < 1}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {phase === "saving" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : null}
              Dodaj u dan
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={phase === "saving"}
              className="rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Slikaj ponovo
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            AI procena je približna — proveri i doteraj po potrebi.
          </p>
        </div>
      ) : null}
    </main>
  );
}

function MacroField({
  label,
  value,
  onChange,
  decimals = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
}) {
  const display = decimals === 0 ? Math.round(value) : round1(value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={Number.isFinite(display) ? display : 0}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
    </label>
  );
}
