"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Check,
  ImageUp,
  Loader2,
  Mic,
  ScanText,
  Sparkles,
  Square,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import type { IPeachQuestion } from "@/lib/ai/ipeach";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { downscaleImage } from "@/lib/image/downscale";
import { logMealAction } from "../obrok/actions";
import { analyzeMealAction, finalizeMealAction } from "./actions";

type Phase =
  | "mode"
  | "capture"
  | "analyzing"
  | "questions"
  | "finalizing"
  | "confirm"
  | "saving";
type Mode = "obrok" | "deklaracija";

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

const MAX_IMAGES = 5;
const RECOMMENDED_IMAGES = 2;
// Safety cap so a forgotten "Zaustavi" can't record forever.
const MAX_RECORDING_MS = 60_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Read a Blob as base64 (no `data:` prefix). Client-only. */
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Downscaled blobs of the captured photos, cached so we don't re-encode them
  // between the analyze and finalize calls.
  const downscaledRef = useRef<Blob[] | null>(null);

  // Voice: one recording that can answer all the AI's questions at once.
  const recordingRef = useRef<WavRecording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wavBlobRef = useRef<Blob | null>(null);

  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<Mode>("obrok");
  const [error, setError] = useState<string | null>(null);

  // Captured photos (originals) + their preview URLs (index-aligned).
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // AI questions + the user's tapped answers (index-aligned to `questions`).
  const [questions, setQuestions] = useState<IPeachQuestion[]>([]);
  const [answers, setAnswers] = useState<string[][]>([]);
  const [note, setNote] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState<number | null>(null);

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

  // Release the mic / clear timers / revoke previews on unmount.
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guide =
    mode === "deklaracija"
      ? {
          captureTitle: "Slikaj deklaraciju (nutritivnu tabelu)",
          captureSub:
            "Dodaj i sliku pakovanja ako se na njemu vidi ukupna masa. AI će te pitati koliko si pojeo.",
        }
      : {
          captureTitle: "Slikaj obrok",
          captureSub:
            "Preporuka: 2 slike iz različitih uglova (odozgo i sa strane) — AI tako lakše proceni količinu.",
        };

  function handleAddPhotos(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    setError(null);
    setFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) return prev;
      const next = picked.slice(0, room);
      setPreviews((urls) => [
        ...urls,
        ...next.map((f) => URL.createObjectURL(f)),
      ]);
      return [...prev, ...next];
    });
  }

  function removePhoto(index: number) {
    setPreviews((urls) => {
      const url = urls[index];
      if (url) URL.revokeObjectURL(url);
      return urls.filter((_, i) => i !== index);
    });
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

  /** Downscale the captured photos once and cache the blobs for reuse. */
  async function downscaledBlobs(): Promise<Blob[]> {
    if (downscaledRef.current) return downscaledRef.current;
    const blobs = await Promise.all(
      files.map((f) => downscaleImage(f, 1568, 0.9))
    );
    downscaledRef.current = blobs;
    return blobs;
  }

  function appendImages(fd: FormData, blobs: Blob[]) {
    blobs.forEach((b, i) => fd.append("slike", b, `obrok-${i}.jpg`));
    fd.append("tip", mode);
  }

  function applyEstimate(est: CombinedMealEstimate) {
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

  async function handleAnalyze() {
    if (files.length === 0) {
      setError("Dodaj bar jednu sliku.");
      return;
    }
    setError(null);
    setPhase("analyzing");
    try {
      const blobs = await downscaledBlobs();
      const fd = new FormData();
      appendImages(fd, blobs);

      const result = await analyzeMealAction(fd);
      if (!result.ok) {
        setError(result.error_sr);
        setPhase("capture");
        return;
      }

      if (result.data.status === "procena") {
        // Model was already confident — skip questions straight to confirm.
        applyEstimate(result.data.estimate);
        return;
      }

      setQuestions(result.data.pitanja);
      setAnswers(result.data.pitanja.map(() => []));
      setNote("");
      wavBlobRef.current = null;
      setRecordedSeconds(null);
      setPhase("questions");
    } catch {
      setError("Nismo uspeli da analiziramo. Pokušaj ponovo.");
      setPhase("capture");
    }
  }

  function toggleOption(qi: number, option: string, multi: boolean) {
    setError(null);
    setAnswers((prev) => {
      const next = prev.map((a) => a.slice());
      const cur = next[qi] ?? [];
      if (multi) {
        next[qi] = cur.includes(option)
          ? cur.filter((o) => o !== option)
          : [...cur, option];
      } else {
        next[qi] = cur.includes(option) ? [] : [option];
      }
      return next;
    });
  }

  const allTapped =
    questions.length > 0 && questions.every((_, i) => (answers[i]?.length ?? 0) > 0);
  const hasVoiceOrText =
    wavBlobRef.current != null || note.trim().length > 0;
  const canFinalize = questions.length > 0 && (allTapped || hasVoiceOrText);

  function buildAnswersText(): string {
    const lines = questions.map((q, i) => {
      const sel = answers[i] ?? [];
      const a = sel.length > 0 ? sel.join(", ") : "(odgovoreno glasom)";
      return `Pitanje: ${q.pitanje}\nOdgovor: ${a}`;
    });
    if (note.trim()) lines.push(`Dodatno: ${note.trim()}`);
    return lines.join("\n\n");
  }

  async function handleFinalize() {
    if (!canFinalize) {
      setError("Odgovori na pitanja — tapni opcije ili odgovori glasom.");
      return;
    }
    setError(null);
    setPhase("finalizing");
    try {
      const blobs = await downscaledBlobs();
      const fd = new FormData();
      appendImages(fd, blobs);
      fd.append("odgovori", buildAnswersText());
      if (wavBlobRef.current) {
        fd.append("audio", wavBlobRef.current, "odgovor.wav");
      }

      const result = await finalizeMealAction(fd);
      if (!result.ok) {
        setError(result.error_sr);
        setPhase("questions");
        return;
      }
      applyEstimate(result.data);
    } catch {
      setError("Nismo uspeli da procenimo. Pokušaj ponovo.");
      setPhase("questions");
    }
  }

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

    // Small display thumbnail: the first photo (best-effort).
    let photo: { base64: string; mimeType?: string } | undefined;
    const file = files[0];
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
          iPeach mtd
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Otkaži
        </Link>
      </header>

      {/* Camera: native rear camera. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleAddPhotos}
      />
      {/* Upload: multiple from library / files. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleAddPhotos}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {phase === "mode" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Šta slikaš? AI će pogledati slike i pitati te samo ono što mu je
            nejasno — zato je procena najtačnija.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode("obrok");
              setPhase("capture");
            }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <UtensilsCrossed className="size-6 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-base font-medium text-foreground">Obrok</span>
              <span className="text-sm text-muted-foreground">
                Slikaj jelo (može više uglova) pa odgovori na pitanja
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("deklaracija");
              setPhase("capture");
            }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <ScanText className="size-6 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-base font-medium text-foreground">
                Deklaracija
              </span>
              <span className="text-sm text-muted-foreground">
                Slikaj nutritivnu tabelu pa odgovori na pitanja
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {phase === "capture" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-foreground">
              {guide.captureTitle}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{guide.captureSub}</p>
          </div>

          {/* Thumbnails of what's captured so far */}
          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5">
              {previews.map((url, i) => (
                <div key={url} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Slika ${i + 1}`}
                    className="size-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Ukloni sliku ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background shadow"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {files.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label="Dodaj još jednu sliku"
                  className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Camera className="size-6" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
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
                Preporuka: {RECOMMENDED_IMAGES} slike iz različitih uglova
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={files.length >= MAX_IMAGES}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <ImageUp className="size-4" aria-hidden="true" />
            Otpremi postojeće slike
          </button>

          {files.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground"
            >
              <Sparkles className="size-5" aria-hidden="true" />
              Analiziraj {files.length > 1 ? `(${files.length} slike)` : ""}
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === "analyzing" ? (
        <AiThinking
          title="Gledam tvoje slike…"
          lines={[
            "Prepoznajem šta je na tanjiru…",
            "Poredim uglove i razmeru…",
            "Spremam pitanja ako nešto nije jasno…",
          ]}
        />
      ) : null}

      {phase === "questions" ? (
        <div className="flex flex-col gap-5">
          {previews.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {previews.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Slika ${i + 1}`}
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>Još par sitnica da procena bude tačna</span>
          </div>

          {/* AI questions with tappable options */}
          <div className="flex flex-col gap-5">
            {questions.map((q, qi) => {
              const selected = answers[qi] ?? [];
              return (
                <div key={qi} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-medium text-foreground">
                      {q.pitanje}
                    </span>
                    {q.vise_odgovora ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        može više
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.opcije.map((option) => {
                      const on = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            toggleOption(qi, option, q.vise_odgovora)
                          }
                          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:bg-muted"
                          }`}
                        >
                          {on ? <Check className="size-3.5" aria-hidden="true" /> : null}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global voice answer — covers everything at once when there's more
              to say than the chips capture. */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-4">
            <span className="text-sm font-medium text-foreground">
              …ili odgovori glasom na sve
            </span>
            {!isRecording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
                className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground animate-pulse"
              >
                <Square className="size-4 fill-current" aria-hidden="true" />
                Snimam… {formatSeconds(seconds)} — zaustavi
              </button>
            )}
            {recordedSeconds != null && !isRecording ? (
              <p className="text-xs text-primary">Snimak spreman ✓</p>
            ) : null}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="…ili dopiši nešto (opciono)"
              className="mt-1 rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleFinalize()}
              disabled={isRecording || !canFinalize}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Sparkles className="size-5" aria-hidden="true" />
              Nastavi
            </button>
            <button
              type="button"
              onClick={() => setPhase("capture")}
              disabled={isRecording}
              className="rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Nazad na slike
            </button>
          </div>
        </div>
      ) : null}

      {phase === "finalizing" ? (
        <AiThinking
          title="Računam tvoju porciju…"
          lines={[
            "Spajam slike i tvoje odgovore…",
            "Računam makronutrijente…",
            "Skoro gotovo…",
          ]}
        />
      ) : null}

      {(phase === "confirm" || phase === "saving") && estimate ? (
        <div className="flex flex-col gap-5">
          {previews[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[0]}
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
