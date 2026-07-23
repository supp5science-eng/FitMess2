"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";

import type { VoiceMealEstimate } from "@/lib/ai/voice-estimate";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { logMealAction } from "../obrok/actions";
import { estimateVoiceMealAction } from "./actions";

type Phase = "idle" | "recording" | "estimating" | "confirm" | "saving";

interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const CONFIDENCE_LABEL: Record<VoiceMealEstimate["sigurnost"], string> = {
  niska: "Niska sigurnost",
  srednja: "Srednja sigurnost",
  visoka: "Visoka sigurnost",
};

// Safety cap: nobody needs to speak a single meal for longer than this, and it
// keeps the clip (and the API cost) bounded even if "Zaustavi" is forgotten.
const MAX_RECORDING_MS = 60_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function GlasFlow() {
  const router = useRouter();
  const recordingRef = useRef<WavRecording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const [estimate, setEstimate] = useState<VoiceMealEstimate | null>(null);
  // Per-100g reference derived from the estimate, so editing grams rescales the
  // macros the same way the meal-photo flow does.
  const [per100, setPer100] = useState<Nutrition | null>(null);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState(0);
  const [nutrition, setNutrition] = useState<Nutrition>({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Elapsed-time ticker while recording (the counter is reset in
  // `startRecording`, so the effect only owns the interval).
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Release the mic / clear the timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      recordingRef.current = await startWavRecording();
      setSeconds(0);
      setPhase("recording");
      autoStopRef.current = setTimeout(() => void stopRecording(), MAX_RECORDING_MS);
    } catch {
      setError(
        "Nismo dobili pristup mikrofonu. Dozvoli mikrofon u podešavanjima pa pokušaj ponovo."
      );
      setPhase("idle");
    }
  }

  async function stopRecording() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    setPhase("estimating");
    let wav: Blob;
    try {
      wav = await recording.stop();
    } catch {
      setError("Nismo uspeli da obradimo snimak. Pokušaj ponovo.");
      setPhase("idle");
      return;
    }

    const formData = new FormData();
    formData.append("audio", wav, "obrok.wav");

    const result = await estimateVoiceMealAction(formData);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("idle");
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

  // Changing grams recomputes every macro from the estimate's per-100g ratio.
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

  function resetToIdle() {
    setEstimate(null);
    setPer100(null);
    setName("");
    setGrams(0);
    setNutrition({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    setError(null);
    setPhase("idle");
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
          Reci obrok
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Otkaži
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {phase === "idle" ? (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <button
            type="button"
            onClick={() => void startRecording()}
            aria-label="Počni snimanje"
            className="flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <Mic className="size-11" aria-hidden="true" />
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-base font-medium text-foreground">
              Dodirni i reci šta si jeo ili pio
            </span>
            <span className="text-sm text-muted-foreground">
              Možeš izgovoriti vrednosti sa deklaracije, ili samo opisati obrok —
              AI će proceniti.
            </span>
          </div>
        </div>
      ) : null}

      {phase === "recording" ? (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <button
            type="button"
            onClick={() => void stopRecording()}
            aria-label="Zaustavi snimanje"
            className="flex size-28 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px animate-pulse"
          >
            <Square className="size-10 fill-current" aria-hidden="true" />
          </button>
          <div className="flex flex-col gap-1">
            <span
              className="text-lg font-semibold tabular-nums text-foreground"
              aria-live="polite"
            >
              {formatSeconds(seconds)}
            </span>
            <span className="text-sm text-muted-foreground">
              Snimam… dodirni da zaustaviš
            </span>
          </div>
        </div>
      ) : null}

      {phase === "estimating" ? (
        <AiThinking
          title="Slušam i računam…"
          lines={[
            "Razumem šta si rekao…",
            "Prepoznajem obrok i količinu…",
            "Računam makronutrijente…",
          ]}
        />
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
            <span className="text-sm font-medium text-foreground">Gramaža (g)</span>
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
              onClick={resetToIdle}
              disabled={phase === "saving"}
              className="rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Snimi ponovo
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

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
