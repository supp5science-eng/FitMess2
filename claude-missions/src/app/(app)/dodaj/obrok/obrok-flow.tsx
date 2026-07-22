"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, ImageUp, Loader2, Sparkles } from "lucide-react";

import type { MealEstimate } from "@/lib/ai/meal-estimate";
import { downscaleImage } from "@/lib/image/downscale";
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

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Read a Blob as base64 (no `data:` prefix) for upload. Client-only. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ObrokFlow() {
  const router = useRouter();
  // Two separate inputs so each intent is unambiguous:
  //  - cameraInputRef has `capture="environment"`, so a tap opens the phone's
  //    native rear camera DIRECTLY (with its own 0.5x/1x lens + zoom controls),
  //    never the "take photo or choose file" chooser.
  //  - uploadInputRef has NO `capture`, so it opens the photo library / files
  //    for a picture taken earlier.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // The captured photo, kept so we can store a small display thumbnail with the
  // log on save (the full image goes to Gemini for the estimate, separately).
  const capturedFileRef = useRef<File | null>(null);
  // Best-effort: try to open the camera the moment we land here, so "Slikaj
  // obrok" feels like it goes straight to the camera. Browsers that require a
  // fresh user gesture (notably iOS Safari) will ignore this no-op and the user
  // taps the big camera button instead -- so it enhances where allowed and
  // degrades to one tap everywhere else. Fires once per mount.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    cameraInputRef.current?.click();
  }, []);

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
    capturedFileRef.current = file;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhase("estimating");

    // Vece razmere + visi kvalitet nego default: prepoznavanje hrane gubi
    // sitne sastojke na 1280px/q0.82. Obrok ide na Pro model, pa mu dajemo
    // ostriju sliku (deklaracija namerno ostaje na jeftinijem defaultu).
    const blob = await downscaleImage(file, 1568, 0.9);
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

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handlePhoto(file);
    // Reset so picking the same file again still fires onChange.
    event.target.value = "";
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

    // A small display thumbnail (separate, smaller than the estimate image) to
    // store with the log. Best-effort: if it fails we still save the meal.
    let photo: { base64: string; mimeType?: string } | undefined;
    const file = capturedFileRef.current;
    if (file) {
      try {
        const thumb = await downscaleImage(file, 720, 0.72);
        photo = { base64: await blobToBase64(thumb), mimeType: "image/jpeg" };
      } catch {
        photo = undefined;
      }
    }

    const result = await logMealAction(
      {
        name,
        grams,
        kcal: nutrition.kcal,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      },
      photo
    );
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

      {/* Camera: opens the native rear camera directly (with 0.5x/1x lens +
          zoom controls) thanks to `capture`. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleInputChange}
      />
      {/* Upload: no `capture`, so it opens the photo library / files for a
          picture the user took earlier. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
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
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center transition-colors hover:bg-muted"
          >
            <Camera className="size-9 text-primary" aria-hidden="true" />
            <span className="text-base font-medium text-foreground">
              Otvori kameru
            </span>
            <span className="text-sm text-muted-foreground">
              AI će proceniti kalorije i makronutrijente
            </span>
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ImageUp className="size-4" aria-hidden="true" />
            Otpremi postojeću sliku
          </button>
        </div>
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={phase === "saving"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <Camera className="size-4" aria-hidden="true" />
                Slikaj ponovo
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={phase === "saving"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <ImageUp className="size-4" aria-hidden="true" />
                Otpremi drugu
              </button>
            </div>
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
