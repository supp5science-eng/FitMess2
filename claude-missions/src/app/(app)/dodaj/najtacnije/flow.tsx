"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Check,
  HelpCircle,
  ImageUp,
  Loader2,
  Mic,
  RotateCcw,
  ScanText,
  Sparkles,
  Square,
  TriangleAlert,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import { ShotGuide } from "@/components/ai/shot-guide";
import type { CombinedMealEstimate } from "@/lib/ai/combined-estimate";
import {
  DONT_KNOW_LABEL,
  OTHER_LABEL,
  type PrizmaQuestion,
  type ReferenceObject,
} from "@/lib/ai/prizma";
import type { MealComponent } from "@/lib/ai/meal-estimate";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { downscaleImage } from "@/lib/image/downscale";
import { inspectPhoto, type PhotoIssue } from "@/lib/image/quality";
import { logMealAction } from "../obrok/actions";
import { analyzeMealAction, finalizeMealAction } from "./actions";

// Prizma v3 — the guided two-angle flow.
//
// The accuracy of every other add-flow is capped by one thing: a photo cannot
// weigh food. This screen's job is to go and get what the photo is missing,
// in the order that actually moves the number:
//
//   guide -> shot 1 (top-down)  ->  what's beside the plate?
//   guide -> shot 2 (45°)       ->  AI's own questions  ->  itemised result
//
// The two guides are motion graphics rather than instructions because nobody
// reads a paragraph before taking a photo, and the whole feature collapses if
// the second angle doesn't happen. The reference object (a fork, ~19-20 cm)
// is what gives the model metric scale -- the one thing a depth sensor would
// have provided and a phone camera can't.

type Phase =
  | "mode"
  | "guide1"
  | "review1"
  | "guide2"
  | "review2"
  | "capture" // label mode only: plain multi-shot capture
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
// Safety cap so a forgotten "Zaustavi" can't record forever.
const MAX_RECORDING_MS = 60_000;
/** Remembers that the user asked to stop seeing the capture guides. */
const SKIP_GUIDE_KEY = "fm_ipeach_skip_guide";

const REFERENCE_CHOICES: { value: ReferenceObject; label: string }[] = [
  { value: "viljuska", label: "Viljuška" },
  { value: "kasika", label: "Kašika" },
  { value: "kartica", label: "Kartica" },
  { value: "nista", label: "Ništa" },
];

const PHOTO_ISSUE_TEXT: Record<PhotoIssue, string> = {
  mutna: "Slika deluje mutno",
  tamna: "Slika je tamna",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Has the user asked us to stop showing the capture guides? Read on demand
 * rather than into state on mount: touching `localStorage` during render would
 * differ between server and client, and syncing it in an effect is exactly the
 * cascading-render pattern this codebase avoids. */
function readSkipGuides(): boolean {
  try {
    return window.localStorage.getItem(SKIP_GUIDE_KEY) === "1";
  } catch {
    // Private mode / storage disabled -- guides simply stay on.
    return false;
  }
}

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

/** Sum an itemised breakdown back into plate totals. */
function totalsOf(parts: MealComponent[]) {
  return parts.reduce(
    (acc, c) => ({
      grams: acc.grams + c.grami,
      kcal: acc.kcal + c.kcal,
      protein: acc.protein + c.protein_g,
      carbs: acc.carbs + c.uh_g,
      fat: acc.fat + c.mast_g,
    }),
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function NajtacnijeFlow() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Downscaled blobs of the captured photos, cached so we don't re-encode them
  // between the analyze and finalize calls.
  const downscaledRef = useRef<Blob[] | null>(null);
  // Which slot a pending camera launch should fill (null = append).
  const retakeIndexRef = useRef<number | null>(null);
  // Where to go once a photo comes back from the camera.
  const nextPhaseRef = useRef<Phase | null>(null);

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
  const [issues, setIssues] = useState<PhotoIssue[][]>([]);
  const [reference, setReference] = useState<ReferenceObject | null>(null);
  const [confirmSkipShot, setConfirmSkipShot] = useState(false);

  // AI questions + the user's tapped answers (index-aligned to `questions`).
  const [questions, setQuestions] = useState<PrizmaQuestion[]>([]);
  const [answers, setAnswers] = useState<string[][]>([]);
  const [note, setNote] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState<number | null>(null);

  const [estimate, setEstimate] = useState<CombinedMealEstimate | null>(null);
  const [components, setComponents] = useState<MealComponent[]>([]);
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

  /** Open the camera for a specific slot, and remember where to land after. */
  function openCamera(next: Phase, replaceIndex: number | null = null) {
    retakeIndexRef.current = replaceIndex;
    nextPhaseRef.current = next;
    setError(null);
    cameraInputRef.current?.click();
  }

  async function handleAddPhotos(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    const replaceAt = retakeIndexRef.current;
    const next = nextPhaseRef.current;
    retakeIndexRef.current = null;
    nextPhaseRef.current = null;
    setError(null);
    // Any new photo invalidates the cached downscales.
    downscaledRef.current = null;

    if (replaceAt != null) {
      const file = picked[0];
      if (!file) return;
      setPreviews((urls) => {
        const old = urls[replaceAt];
        if (old) URL.revokeObjectURL(old);
        const copy = urls.slice();
        copy[replaceAt] = URL.createObjectURL(file);
        return copy;
      });
      setFiles((prev) => {
        const copy = prev.slice();
        copy[replaceAt] = file;
        return copy;
      });
      void checkPhoto(file, replaceAt);
    } else {
      setFiles((prev) => {
        const room = MAX_IMAGES - prev.length;
        if (room <= 0) return prev;
        const added = picked.slice(0, room);
        const startIndex = prev.length;
        setPreviews((urls) => [
          ...urls,
          ...added.map((f) => URL.createObjectURL(f)),
        ]);
        added.forEach((f, i) => void checkPhoto(f, startIndex + i));
        return [...prev, ...added];
      });
    }

    if (next) setPhase(next);
  }

  /** Run the cheap local blur/exposure check and record the result. */
  async function checkPhoto(file: File, index: number) {
    const found = await inspectPhoto(file);
    setIssues((prev) => {
      const copy = prev.slice();
      copy[index] = found;
      return copy;
    });
  }

  function removePhoto(index: number) {
    setPreviews((urls) => {
      const url = urls[index];
      if (url) URL.revokeObjectURL(url);
      return urls.filter((_, i) => i !== index);
    });
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setIssues((prev) => prev.filter((_, i) => i !== index));
    downscaledRef.current = null;
  }

  function dismissGuides() {
    try {
      window.localStorage.setItem(SKIP_GUIDE_KEY, "1");
    } catch {
      // Preference just won't persist; not worth surfacing.
    }
  }

  /** The "?" in the header: bring the guides back and jump straight to them. */
  function restoreGuides() {
    try {
      window.localStorage.removeItem(SKIP_GUIDE_KEY);
    } catch {
      // As above.
    }
    setMode("obrok");
    setPhase("guide1");
  }

  function startObrok() {
    setMode("obrok");
    // Someone who has dismissed the guides goes straight to the camera.
    if (readSkipGuides()) openCamera("review1");
    else setPhase("guide1");
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
    fd.append("referenca", reference ?? "nista");
  }

  function applyEstimate(est: CombinedMealEstimate) {
    const g = est.procenjeni_grami;
    setEstimate(est);
    setComponents(est.komponente);
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
        setPhase(mode === "deklaracija" ? "capture" : "review2");
        return;
      }

      if (result.data.status === "procena") {
        // Every item read clearly — nothing worth asking about.
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
      setPhase(mode === "deklaracija" ? "capture" : "review2");
    }
  }

  function toggleOption(qi: number, option: string, multi: boolean) {
    setError(null);
    setAnswers((prev) => {
      const next = prev.map((a) => a.slice());
      const cur = next[qi] ?? [];
      // "Ne znam" and "Nešto drugo" are exclusive: they replace a real answer
      // rather than stacking with one.
      const isEscape = option === DONT_KNOW_LABEL || option === OTHER_LABEL;
      if (multi && !isEscape) {
        const without = cur.filter(
          (o) => o !== DONT_KNOW_LABEL && o !== OTHER_LABEL
        );
        next[qi] = without.includes(option)
          ? without.filter((o) => o !== option)
          : [...without, option];
      } else {
        next[qi] = cur.includes(option) ? [] : [option];
      }
      return next;
    });
  }

  const allTapped =
    questions.length > 0 && questions.every((_, i) => (answers[i]?.length ?? 0) > 0);
  const hasVoiceOrText = wavBlobRef.current != null || note.trim().length > 0;
  const canFinalize = questions.length > 0 && (allTapped || hasVoiceOrText);
  // "Nešto drugo" only means something once they've actually said what.
  const needsDetail = questions.some(
    (_, i) => (answers[i] ?? []).includes(OTHER_LABEL)
  );

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
    if (needsDetail && !hasVoiceOrText) {
      setError(`Rekao si „${OTHER_LABEL}" — dopiši ili reci šta je bilo.`);
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

  /** Scale the whole plate (and its breakdown) to a new total weight. */
  function handleGramsChange(value: number) {
    const previous = grams;
    setGrams(value);
    if (per100) {
      setNutrition({
        kcal: (per100.kcal * value) / 100,
        protein: (per100.protein * value) / 100,
        carbs: (per100.carbs * value) / 100,
        fat: (per100.fat * value) / 100,
      });
    }
    // Keep the itemisation honest about the new total.
    if (components.length > 0 && previous > 0 && value > 0) {
      const factor = value / previous;
      setComponents((prev) =>
        prev.map((c) => ({
          naziv: c.naziv,
          grami: c.grami * factor,
          kcal: c.kcal * factor,
          protein_g: c.protein_g * factor,
          uh_g: c.uh_g * factor,
          mast_g: c.mast_g * factor,
        }))
      );
    }
  }

  /** Strike a line the user didn't actually eat and re-derive the totals. */
  function removeComponent(index: number) {
    const next = components.filter((_, i) => i !== index);
    setComponents(next);
    if (next.length === 0) {
      setGrams(0);
      setNutrition({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
      return;
    }
    const t = totalsOf(next);
    setGrams(Math.round(t.grams));
    setNutrition({
      kcal: t.kcal,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
    });
    if (t.grams > 0) {
      setPer100({
        kcal: (t.kcal / t.grams) * 100,
        protein: (t.protein / t.grams) * 100,
        carbs: (t.carbs / t.grams) * 100,
        fat: (t.fat / t.grams) * 100,
      });
    }
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

  const shotIssues = (index: number) => issues[index] ?? [];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Prizma
        </h1>
        <div className="flex items-center gap-3">
          {/* Always available, so dismissing the guides is never one-way. */}
          <button
            type="button"
            onClick={restoreGuides}
            aria-label="Prikaži vodič za slikanje"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <HelpCircle className="size-5" aria-hidden="true" />
          </button>
          <Link
            href="/danas"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Otkaži
          </Link>
        </div>
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
            Dve slike iz dva ugla i par pitanja — zato je ovo najtačnija procena
            u aplikaciji.
          </p>
          <button
            type="button"
            onClick={startObrok}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <UtensilsCrossed className="size-6 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-base font-medium text-foreground">Obrok</span>
              <span className="text-sm text-muted-foreground">
                Vodimo te kroz dva ugla pa AI pita šta mu nije jasno
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

      {/* --- Guide 1: straight down ------------------------------------- */}
      {phase === "guide1" ? (
        <GuideStep
          step={1}
          title="Slikaj pravo odozgo"
          subtitle="Tako vidim koliko je hrane po širini tanjira."
          variant="top"
          tips={[
            "Stavi viljušku ili kašiku PORED tanjira — po njoj merim veličinu",
            "Ceo tanjir u kadru",
            "Dobro svetlo — bez senke preko tanjira",
          ]}
          cta="Jasno — otvori kameru"
          onStart={() => openCamera("review1")}
          onDismissGuides={dismissGuides}
          onBack={() => setPhase("mode")}
        />
      ) : null}

      {/* --- Review 1 + reference object -------------------------------- */}
      {phase === "review1" ? (
        <div className="flex flex-col gap-5">
          <StepBadge step={1} label="Slika odozgo" />

          {previews[0] ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[0]}
                alt="Slika odozgo"
                className="max-h-56 w-full rounded-2xl object-cover"
              />
              <button
                type="button"
                onClick={() => openCamera("review1", 0)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-2 text-xs font-medium text-foreground backdrop-blur"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Slikaj ponovo
              </button>
            </div>
          ) : null}

          <PhotoWarning issues={shotIssues(0)} />

          <div className="flex flex-col gap-2.5">
            <span className="text-base font-medium text-foreground">
              Šta si stavio pored tanjira?
            </span>
            <p className="-mt-1 text-xs text-muted-foreground">
              Po tome merim koliko je tanjir velik — bez toga samo pogađam.
            </p>
            <div className="flex flex-wrap gap-2">
              {REFERENCE_CHOICES.map((choice) => {
                const on = reference === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setReference(choice.value)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {on ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {choice.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={reference === null}
            onClick={() => {
              if (readSkipGuides()) openCamera("review2");
              else setPhase("guide2");
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            Dalje — druga slika
          </button>
        </div>
      ) : null}

      {/* --- Guide 2: the 45° angle ------------------------------------- */}
      {phase === "guide2" ? (
        <GuideStep
          step={2}
          title="Sad malo iz ugla"
          subtitle="Odozgo se vidi širina, iz ugla visina. Zajedno mi daju količinu."
          variant="angle"
          tips={[
            "Viljuška neka ostane PORED tanjira, kao na prvoj slici",
            "Spusti telefon na oko 45°",
            "Isti tanjir — ne pomeraj hranu",
          ]}
          cta="Otvori kameru"
          onStart={() => openCamera("review2")}
          onDismissGuides={dismissGuides}
          onBack={() => setPhase("review1")}
          footer={
            confirmSkipShot ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
                <div className="flex gap-2.5">
                  <TriangleAlert
                    className="size-5 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-foreground">
                    Bez drugog ugla ne vidim koliko je jelo visoko, pa procena
                    zna da promaši i za trećinu. Preporuka je da ipak slikaš.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmSkipShot(false);
                      openCamera("review2");
                    }}
                    className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    Dobro, slikaću
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmSkipShot(false);
                      void handleAnalyze();
                    }}
                    className="rounded-xl px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Ipak nastavi sa jednom slikom
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSkipShot(true)}
                className="rounded-xl px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Nemam drugu sliku
              </button>
            )
          }
        />
      ) : null}

      {/* --- Review 2: both angles, extra angles optional --------------- */}
      {phase === "review2" ? (
        <div className="flex flex-col gap-5">
          <StepBadge step={2} label="Spremno za analizu" />

          <div className="grid grid-cols-3 gap-2.5">
            {previews.map((url, i) => (
              <div key={url} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Slika ${i + 1}`}
                  className="size-full rounded-xl object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur">
                  {i === 0 ? "odozgo" : i === 1 ? "45°" : `ugao ${i + 1}`}
                </span>
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
                onClick={() => openCamera("review2")}
                aria-label="Dodaj još jedan ugao"
                className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted"
              >
                <Camera className="size-6" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <PhotoWarning issues={shotIssues(1)} />

          <button
            type="button"
            onClick={() => void handleAnalyze()}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground"
          >
            <Sparkles className="size-5" aria-hidden="true" />
            Analiziraj
          </button>
        </div>
      ) : null}

      {/* --- Label mode: plain capture ---------------------------------- */}
      {phase === "capture" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
            <p className="text-sm font-medium text-foreground">
              Slikaj deklaraciju (nutritivnu tabelu)
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dodaj i sliku pakovanja ako se na njemu vidi ukupna masa. AI će te
              pitati koliko si pojeo.
            </p>
          </div>

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
                  onClick={() => openCamera("capture")}
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
              onClick={() => openCamera("capture")}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center transition-colors hover:bg-muted"
            >
              <Camera className="size-9 text-primary" aria-hidden="true" />
              <span className="text-base font-medium text-foreground">
                Otvori kameru
              </span>
              <span className="text-sm text-muted-foreground">
                Neka tabela bude oštra i cela u kadru
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
              Analiziraj
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === "analyzing" ? (
        <AiThinking
          title="Gledam tvoje slike…"
          lines={[
            "Prepoznajem šta je na tanjiru…",
            "Merim porciju po viljušci…",
            "Spajam širinu i visinu…",
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
            <span>Ovo ne mogu da vidim sa slike</span>
          </div>

          <div className="flex flex-col gap-6">
            {questions.map((q, qi) => {
              const selected = answers[qi] ?? [];
              // The escape hatches are appended by us, not the model.
              const options = [...q.opcije, DONT_KNOW_LABEL, OTHER_LABEL];
              return (
                <div key={qi} className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
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
                    {/* Why this question exists, in the AI's own words — so it
                        reads as "I looked at YOUR plate", not a checklist. */}
                    {q.zasto ? (
                      <span className="text-xs text-muted-foreground">
                        {q.zasto}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => {
                      const on = selected.includes(option);
                      const isEscape =
                        option === DONT_KNOW_LABEL || option === OTHER_LABEL;
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
                              : isEscape
                                ? "border-dashed border-border bg-background text-muted-foreground hover:bg-muted"
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

          {/* Voice/text: the way out when the chips don't cover it. */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-4">
            <span className="text-sm font-medium text-foreground">
              {needsDetail ? "Reci šta je bilo" : "…ili odgovori glasom na sve"}
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
              onClick={() =>
                setPhase(mode === "deklaracija" ? "capture" : "review2")
              }
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
            "Razlažem obrok na sastojke…",
            "Sabiram makronutrijente…",
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Naziv</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>

          {/* The breakdown: where the number came from, and the chance to
              strike anything they didn't eat. */}
          {components.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Od čega se sastoji
                </span>
                <span className="text-xs text-muted-foreground">
                  skloni što nisi jeo
                </span>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {components.map((c, i) => (
                  <li
                    key={`${c.naziv}-${i}`}
                    className="flex items-center gap-3 bg-background px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {c.naziv}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(c.grami)} g · P {round1(c.protein_g)} · UH{" "}
                        {round1(c.uh_g)} · M {round1(c.mast_g)}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {Math.round(c.kcal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeComponent(i)}
                      aria-label={`Skloni ${c.naziv}`}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : estimate.sastojci.length > 0 ? (
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

/** Small "1 / 2" pill that keeps the two-shot flow legible. */
function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
        {step} / 2
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

/** One of the two teaching screens: animation, what to do, why, and the CTA. */
function GuideStep({
  step,
  title,
  subtitle,
  variant,
  tips,
  cta,
  onStart,
  onDismissGuides,
  onBack,
  footer,
}: {
  step: number;
  title: string;
  subtitle: string;
  variant: "top" | "angle";
  tips: string[];
  cta: string;
  onStart: () => void;
  onDismissGuides: () => void;
  onBack: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepBadge step={step} label={step === 1 ? "Prva slika" : "Druga slika"} />

      <ShotGuide variant={variant} />

      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-sm text-foreground">{tip}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground"
        >
          <Camera className="size-5" aria-hidden="true" />
          {cta}
        </button>
        {footer}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Nazad
          </button>
          <button
            type="button"
            onClick={onDismissGuides}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Znam već — ne prikazuj vodič
          </button>
        </div>
      </div>
    </div>
  );
}

/** Gentle heads-up about a soft or dark photo. Never blocks. */
function PhotoWarning({ issues }: { issues: PhotoIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <TriangleAlert className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
      <p className="text-sm text-foreground">
        {issues.map((i) => PHOTO_ISSUE_TEXT[i]).join(" · ")} — procena će biti
        tačnija ako slikaš ponovo.
      </p>
    </div>
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
