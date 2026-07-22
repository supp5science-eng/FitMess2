"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ImageUp,
  Loader2,
  Mic,
  Sparkles,
  Square,
} from "lucide-react";

import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { downscaleImage } from "@/lib/image/downscale";
import { logMealAction } from "../obrok/actions";
import { estimateCombinedAction } from "./actions";

type Phase = "capture" | "describe" | "estimating" | "confirm" | "saving";

interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const CONFIDENCE_LABEL: Record<CombinedMealEstimate["sigurnost"], string> = {
  niska: "Niska sigurnost",
  srednja: "Srednja sigurnost",
  visoka: "Visoka sigurnost",
};

// Safety cap so a forgotten "Zaustavi" can't record forever (and keeps the clip
// + API cost bounded). One meal never needs longer to describe.
const MAX_RECORDING_MS = 60_000;

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

export function NajtacnijeFlow() {
  const router = useRouter();
  // Two inputs: camera (capture -> native camera with 0.5x/1x) + upload.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const capturedFileRef = useRef<File | null>(null);

  // Recording state (mic). The stopped clip is held until the user hits
  // "Analiziraj", so they can also type / re-record first.
  const recordingRef = useRef<WavRecording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wavBlobRef = useRef<Blob | null>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const [estimate, setEstimate] = useState<CombinedMealEstimate | null>(null);
  const [per100, setPer100] = useState<Nutrition | null>(null);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState(0);
  const [nutrition, setNutrition] = useState<Nutrition>({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Elapsed-time ticker while recording.
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  // Release the mic / clear timers if we unmount mid-recording.
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
    };
  }, []);

  function handlePhotoInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    capturedFileRef.current = file;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhase("describe");
  }

  async function startRecording() {
    setError(null);
    try {
      recordingRef.current = await startWavRecording();
      setSeconds(0);
      setIsRecording(true);
      autoStopRef.current = setTimeout(
        () => void stopRecording(),
        MAX_RECORDING_MS
      );
    } catch {
      setError(
        "Nismo dobili pristup mikrofonu. Dozvoli mikrofon u podešavanjima pa pokušaj ponovo."
      );
      setIsRecording(false);
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

    const elapsed = seconds;
    try {
      wavBlobRef.current = await recording.stop();
      setRecordedSeconds(elapsed);
    } catch {
      setError("Nismo uspeli da obradimo snimak. Pokušaj ponovo.");
      wavBlobRef.current = null;
      setRecordedSeconds(null);
    } finally {
      setIsRecording(false);
    }
  }

  const hasDescription = wavBlobRef.current != null || note.trim().length > 0;

  async function handleAnalyze() {
    const file = capturedFileRef.current;
    if (!file) {
      setPhase("capture");
      return;
    }
    if (!hasDescription) {
      setError("Dodaj opis — reci ili napiši šta si pojeo i koliko.");
      return;
    }
    setError(null);
    setPhase("estimating");

    // Sharper image than default: food loses fine ingredients at low quality.
    const blob = await downscaleImage(file, 1568, 0.9);
    const formData = new FormData();
    formData.append("slika", blob, "obrok.jpg");
    if (wavBlobRef.current) {
      formData.append("audio", wavBlobRef.current, "opis.wav");
    }
    if (note.trim()) {
      formData.append("opis", note.trim());
    }

    const result = await estimateCombinedAction(formData);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("describe");
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

    // Small display thumbnail stored with the log (best-effort).
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
          Najtačniji unos
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Otkaži
        </Link>
      </header>

      {/* Camera: native rear camera directly (0.5x/1x). */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handlePhotoInput}
      />
      {/* Upload: no capture -> photo library / files. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handlePhotoInput}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {phase === "capture" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-foreground">
              Za najveću tačnost, uradi oba koraka:
            </p>
            <ol className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              <li>
                <span className="font-semibold text-primary">1.</span> Slikaj
                obrok
              </li>
              <li>
                <span className="font-semibold text-primary">2.</span> Reci ili
                napiši šta je i koliko si pojeo
                <br />
                <span className="text-xs">
                  npr. „pire sa junećim mesom, jedan pun tanjir, pojeo sam skoro
                  sve”
                </span>
              </li>
            </ol>
          </div>

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
              Zatim ćeš opisati obrok za precizniju procenu
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

      {phase === "describe" ? (
        <div className="flex flex-col gap-5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Tvoj obrok"
              className="max-h-56 w-full rounded-2xl object-cover"
            />
          ) : null}

          <div className="flex flex-col gap-1">
            <span className="text-base font-medium text-foreground">
              Reci ili napiši šta si pojeo i koliko
            </span>
            <span className="text-sm text-muted-foreground">
              Tvoja procena količine najviše diže tačnost — npr. „jedan tanjir”,
              „pojeo sam pola”, „dve velike kašike”.
            </span>
          </div>

          {/* Voice */}
          {!isRecording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Mic className="size-5 text-primary" aria-hidden="true" />
              {recordedSeconds != null
                ? `Snimljeno (${recordedSeconds}s) — snimi ponovo`
                : "Reci glasom"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopRecording()}
              className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-6 py-3.5 text-sm font-semibold text-destructive-foreground transition-colors animate-pulse"
            >
              <Square className="size-4 fill-current" aria-hidden="true" />
              Snimam… {formatSeconds(seconds)} — zaustavi
            </button>
          )}

          {recordedSeconds != null && !isRecording ? (
            <p className="text-xs text-primary">Snimak spreman ✓</p>
          ) : null}

          {/* Text (alternative / addition to voice) */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              …ili otkucaj opis
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="npr. pire sa junećim mesom, jedan pun tanjir, pojeo sam skoro sve"
              className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={isRecording || !hasDescription}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Sparkles className="size-5" aria-hidden="true" />
              Analiziraj obrok
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isRecording}
              className="rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Promeni sliku
            </button>
          </div>
        </div>
      ) : null}

      {phase === "estimating" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Spajam sliku i tvoj opis…
          </p>
        </div>
      ) : null}

      {(phase === "confirm" || phase === "saving") && estimate ? (
        <div className="flex flex-col gap-5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Tvoj obrok"
              className="max-h-48 w-full rounded-2xl object-cover"
            />
          ) : null}

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
