"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ImageUp,
  Loader2,
  Pencil,
  Sparkles,
  Target,
} from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import { CameraCapture } from "@/components/camera/camera-capture";
import { useT } from "@/components/i18n/locale-provider";
import {
  scaleMealComponents,
  scaleMealMicros,
  type MealEstimate,
} from "@/lib/ai/meal-estimate";
import { downscaleImage } from "@/lib/image/downscale";
import { estimateMealAction, logMealAction } from "./actions";

// "Slikaj obrok" — the FASTEST way to log a meal, and the deliberate opposite
// of Prizma.
//
// The two methods are a matched pair and the menu names the trade: Prizma buys
// accuracy with effort (a portion dial, the AI's own questions), this one buys
// speed with a single tap of the shutter. That only holds if this flow stays
// genuinely short, so the result screen leads with the ANSWER -- one card, one
// button -- and keeps every edit field folded away behind "Ispravi". Someone
// who wants to correct four macros by hand did not come here for speed; someone
// who wants a better number is pointed at Prizma instead of being handed a form.

type Phase = "capture" | "estimating" | "confirm" | "saving";

interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

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
  const { t } = useT();
  const CONFIDENCE_LABEL: Record<MealEstimate["sigurnost"], string> = {
    niska: t("dodaj.confidence.low"),
    srednja: t("dodaj.confidence.medium"),
    visoka: t("dodaj.confidence.high"),
  };
  const router = useRouter();
  // Two fallback inputs, used only when the live camera can't run:
  //  - cameraInputRef has `capture="environment"`, so a tap hands off to the
  //    phone's own camera app.
  //  - uploadInputRef has NO `capture`, so it opens the photo library / files
  //    for a picture taken earlier. This one is also reachable FROM the live
  //    viewfinder, since "I already have a photo" is a normal thing to want.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // The captured photo, kept so we can store a small display thumbnail with the
  // log on save (the full image goes to Gemini for the estimate, separately).
  const capturedFileRef = useRef<File | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // The edit fields start folded: this is the fast path, so the default
  // interaction is "read the number, tap Dodaj".
  const [isEditing, setIsEditing] = useState(false);

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
    setIsEditing(false);
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

    // 0017 micronutrients, on the AI's own ratio for whatever portion the user
    // confirmed (see `scaleMealMicros`).
    const micros = estimate
      ? scaleMealMicros(estimate, grams)
      : { fiber: null, sugar: null, sodium: null, satFat: null };

    const result = await logMealAction(
      {
        name,
        grams,
        kcal: nutrition.kcal,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: micros.fiber,
        sugar: micros.sugar,
        sodium: micros.sodium,
        satFat: micros.satFat,
        // 0019: itemised breakdown, on the same confirmed-portion ratio as the
        // micros. This is what later powers "Dodaj još → +1 jaje" on a plate
        // that was photographed once.
        components: estimate ? scaleMealComponents(estimate, grams) : undefined,
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
          {t("dodaj.meal.title")}
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("dodaj.cancel")}
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
          alt={t("dodaj.meal.photoAlt")}
          // Small on purpose: on the fast path the photo is confirmation that
          // the right thing was shot, not the content. A tall image pushed the
          // answer -- the whole reason this screen exists -- below the fold.
          className="max-h-40 w-full rounded-2xl object-cover"
        />
      ) : null}

      {/* The camera IS the screen: landing here opens the live viewfinder
          straight away, so "Slikaj obrok" is one tap (the shutter) rather than
          a chooser screen and then a tap. The old chooser lives on as the
          fallback, for when the camera is denied or unavailable. */}
      {phase === "capture" ? (
        <CameraCapture
          onCapture={(file) => void handlePhoto(file)}
          onCancel={() => router.push("/danas")}
          onPickFromLibrary={() => uploadInputRef.current?.click()}
          hint={t("dodaj.meal.hint")}
          // A failed estimate drops back here; the message has to ride on the
          // viewfinder, which covers the page's own error slot.
          notice={error}
          fallback={(reason) => (
            <div className="flex flex-col gap-3">
              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {reason}
              </p>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center transition-colors hover:bg-muted"
              >
                <Camera className="size-9 text-primary" aria-hidden="true" />
                <span className="text-base font-medium text-foreground">
                  {t("dodaj.openCamera")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("dodaj.meal.cameraHint")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {t("dodaj.uploadExisting")}
              </button>
            </div>
          )}
        />
      ) : null}

      {phase === "estimating" ? (
        <AiThinking
          title={t("dodaj.meal.analyzing.title")}
          lines={[
            t("dodaj.meal.analyzing.line1"),
            t("dodaj.meal.analyzing.line2"),
            t("dodaj.meal.analyzing.line3"),
          ]}
        />
      ) : null}

      {(phase === "confirm" || phase === "saving") && estimate ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{CONFIDENCE_LABEL[estimate.sigurnost]}</span>
          </div>

          {/* The answer, first and whole. Everything editable is folded away
              behind "Ispravi" -- reading a card and tapping once is the entire
              point of this method. */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
                {name || t("dodaj.meal.defaultName")}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {grams} g
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                {Math.round(nutrition.kcal)}
              </span>
              <span className="text-base text-muted-foreground">kcal</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                {t("dodaj.macroAbbr.protein")}{" "}
                <strong className="font-medium text-foreground">
                  {round1(nutrition.protein)}
                </strong>
              </span>
              <span>
                {t("dodaj.macroAbbr.carbs")}{" "}
                <strong className="font-medium text-foreground">
                  {round1(nutrition.carbs)}
                </strong>
              </span>
              <span>
                {t("dodaj.macroAbbr.fat")}{" "}
                <strong className="font-medium text-foreground">
                  {round1(nutrition.fat)}
                </strong>
              </span>
            </div>
            {estimate.sastojci.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {estimate.sastojci.join(" · ")}
              </p>
            ) : null}
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">{t("dodaj.field.name")}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {t("dodaj.field.grams")}
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
                  label={t("dodaj.field.kcal")}
                  value={nutrition.kcal}
                  decimals={0}
                  onChange={(v) => setNutrition((n) => ({ ...n, kcal: v }))}
                />
                <MacroField
                  label={t("dodaj.field.protein")}
                  value={nutrition.protein}
                  onChange={(v) => setNutrition((n) => ({ ...n, protein: v }))}
                />
                <MacroField
                  label={t("dodaj.field.carbs")}
                  value={nutrition.carbs}
                  onChange={(v) => setNutrition((n) => ({ ...n, carbs: v }))}
                />
                <MacroField
                  label={t("dodaj.field.fat")}
                  value={nutrition.fat}
                  onChange={(v) => setNutrition((n) => ({ ...n, fat: v }))}
                />
              </div>
            </div>
          ) : null}

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
              {t("dodaj.addToDay")}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing((on) => !on)}
                disabled={phase === "saving"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <Pencil className="size-4" aria-hidden="true" />
                {isEditing ? t("dodaj.hide") : t("dodaj.correct")}
              </button>
              <button
                type="button"
                onClick={() => setPhase("capture")}
                disabled={phase === "saving"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <Camera className="size-4" aria-hidden="true" />
                {t("dodaj.retakePhoto")}
              </button>
            </div>
          </div>

          {/* The escape hatch to the accurate method. A photo alone cannot
              weigh food, so when the number looks wrong the answer is not a
              form to type into -- it is the flow that asks the questions this
              one skips. */}
          <Link
            href="/dodaj/najtacnije"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Target className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("dodaj.meal.tryPrizma")}
          </Link>
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
