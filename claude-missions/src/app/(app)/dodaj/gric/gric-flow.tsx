"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Check, Loader2, Mic, Square, Undo2, X } from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import {
  MEAL_SIZED_KCAL,
  PORTION_SIZES,
  needsConfirmation,
  scaleGricItem,
  totalKcal,
  type GricItem,
  type PortionSizeId,
} from "@/lib/ai/gric-estimate";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import type { FrequentSnack } from "@/lib/gric/frequent";
import { cn } from "@/lib/utils";
import { estimateGricAction, logGricAction } from "./actions";

// "Gric" — the flow for food that never gets logged because logging it costs
// more than the food is worth. Everything here follows from one rule: the user
// should be able to finish without touching the screen a second time.
//
//   idle → recording → estimating → review → (auto) saving → done
//
// `review` is chips, not a form. Low-variance items commit themselves after a
// short countdown; a single high-variance item (cake, burek, a sandwich)
// cancels the countdown and asks for exactly one tap. Nothing is ever
// rejected for being "too big to be a snack" — an oversized gric still saves,
// and only THEN offers a photo as an upgrade.

type Phase =
  | "idle"
  | "recording"
  | "estimating"
  | "review"
  | "saving"
  | "done";

/** Long enough to notice and stop it, short enough that doing nothing is the
 * fast path rather than a wait. */
const AUTOSAVE_SECONDS = 5;

/** A gric is a sentence, not a diary entry. */
const MAX_RECORDING_MS = 30_000;

/** One item as it sits on the review screen: the untouched model output plus
 * the size the user picked (if any). Keeping `base` lets size changes rescale
 * from the original every time instead of compounding. */
interface ReviewItem {
  base: GricItem;
  size: PortionSizeId;
  removed: boolean;
}

const current = (item: ReviewItem): GricItem => scaleGricItem(item.base, item.size);

export function GricFlow({ frequent }: { frequent: FrequentSnack[] }) {
  const router = useRouter();
  const recordingRef = useRef<WavRecording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [savedKcal, setSavedKcal] = useState(0);

  const kept = items.filter((item) => !item.removed);

  // Elapsed-time ticker while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Release the mic / clear timers if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
    };
  }, []);

  // The auto-save countdown. `countdown === null` means "not counting" — set
  // when the review screen opens with nothing worth asking about, cleared the
  // moment the user touches anything (see `stopCountdown`).
  useEffect(() => {
    if (phase !== "review" || countdown === null) return;
    if (countdown <= 0) {
      void save(items);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
    // `items`/`save` are read at fire time; re-running on every keystroke-free
    // tick is exactly what we want and the countdown value is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  /** Any deliberate touch on the review screen means "I'm handling this" —
   * the timer must never save something out from under a user mid-edit. */
  function stopCountdown() {
    setCountdown(null);
  }

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
    formData.append("audio", wav, "gric.wav");

    const result = await estimateGricAction(formData);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("idle");
      return;
    }

    const stavke = result.data.stavke;
    if (stavke.length === 0) {
      setError(
        "Nismo čuli hranu u snimku. Probaj ponovo — reci npr. „pojeo sam krastavac i šaku semenki”."
      );
      setPhase("idle");
      return;
    }

    const review: ReviewItem[] = stavke.map((base) => ({
      base,
      size: "normalno",
      removed: false,
    }));
    setItems(review);
    setPhase("review");
    // Only pause for items whose portion genuinely varies. Everything else
    // saves itself — that is the whole promise of the feature.
    setCountdown(needsConfirmation(stavke) ? null : AUTOSAVE_SECONDS);
  }

  async function save(source: ReviewItem[]) {
    const payload = source
      .filter((item) => !item.removed)
      .map((item) => {
        const scaled = current(item);
        return {
          name: scaled.naziv,
          grams: scaled.grami,
          kcal: scaled.kcal,
          protein: scaled.protein_g,
          carbs: scaled.uh_g,
          fat: scaled.mast_g,
        };
      });

    if (payload.length === 0) {
      router.push("/danas");
      return;
    }

    setCountdown(null);
    setPhase("saving");
    const result = await logGricAction(payload);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("review");
      return;
    }

    const total = payload.reduce((sum, item) => sum + item.kcal, 0);
    // A meal-sized "gric" earns one honest offer to do better, on the way out.
    // Below that we just leave — stopping to congratulate someone for logging a
    // cucumber would cost more attention than the cucumber.
    if (total >= MEAL_SIZED_KCAL) {
      setSavedKcal(total);
      setPhase("done");
      return;
    }
    router.push("/danas");
  }

  /** One-tap re-log of a habit, straight from history — no mic, no AI call. */
  async function logFrequent(snack: FrequentSnack) {
    setError(null);
    setPhase("saving");
    const result = await logGricAction([
      {
        name: snack.name,
        grams: snack.grams,
        kcal: snack.kcal,
        protein: snack.protein,
        carbs: snack.carbs,
        fat: snack.fat,
      },
    ]);
    if (!result.ok) {
      setError(result.error_sr);
      setPhase("idle");
      return;
    }
    router.push("/danas");
  }

  function setSize(index: number, size: PortionSizeId) {
    stopCountdown();
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, size } : item))
    );
  }

  function toggleRemoved(index: number) {
    stopCountdown();
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, removed: !item.removed } : item
      )
    );
  }

  function resetToIdle() {
    setItems([]);
    setCountdown(null);
    setError(null);
    setPhase("idle");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Gric
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
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-5 pt-4 text-center">
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
                Reci šta si gricnuo
              </span>
              <span className="text-sm text-muted-foreground">
                Možeš nabrojati više stvari odjednom — „krastavac, šaka semenki i
                dve kajsije&rdquo;.
              </span>
            </div>
          </div>

          {frequent.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Opet isto
              </h2>
              <div className="flex flex-wrap gap-2">
                {frequent.map((snack) => (
                  <button
                    key={snack.name}
                    type="button"
                    onClick={() => void logFrequent(snack)}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-colors hover:border-primary/50 active:translate-y-px"
                  >
                    <span className="font-medium">{snack.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(snack.kcal)} kcal
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Jedan dodir doda stavku u dan — bez snimanja.
              </p>
            </section>
          ) : null}
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
              Slušam… dodirni da zaustaviš
            </span>
          </div>
        </div>
      ) : null}

      {phase === "estimating" ? (
        <AiThinking
          title="Slušam i računam…"
          lines={[
            "Razdvajam šta si sve pomenuo…",
            "Procenjujem količine…",
            "Računam kalorije…",
          ]}
        />
      ) : null}

      {(phase === "review" || phase === "saving") && items.length > 0 ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {items.map((item, index) => (
              <GricItemCard
                key={`${item.base.naziv}-${index}`}
                item={item}
                disabled={phase === "saving"}
                onSize={(size) => setSize(index, size)}
                onToggle={() => toggleRemoved(index)}
              />
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Ukupno</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">
              ≈ {totalKcal(kept.map(current))} kcal
            </span>
          </div>

          <button
            type="button"
            onClick={() => void save(items)}
            disabled={phase === "saving" || kept.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {phase === "saving" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : null}
            {countdown !== null && phase === "review"
              ? `Dodajem za ${countdown}…`
              : "Dodaj u dan"}
          </button>

          {countdown !== null && phase === "review" ? (
            <button
              type="button"
              onClick={stopCountdown}
              className="text-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sačekaj, hoću da doteram
            </button>
          ) : (
            <button
              type="button"
              onClick={resetToIdle}
              disabled={phase === "saving"}
              className="text-center text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Snimi ponovo
            </button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Procena je približna — za sitnice je to sasvim dovoljno.
          </p>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="flex flex-col gap-5 py-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="size-7" aria-hidden="true" />
            </span>
            <span className="text-base font-medium text-foreground">
              Sačuvano — ≈ {savedKcal} kcal
            </span>
            <p className="text-sm text-muted-foreground">
              Ovo je bio pravi obrok, ne sitnica. Slikaj ga ako hoćeš tačniju
              procenu — sve ostaje zabeleženo i bez toga.
            </p>
          </div>
          <Link
            href="/dodaj/obrok"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-base font-medium text-foreground"
          >
            <Camera className="size-5" aria-hidden="true" />
            Slikaj obrok
          </Link>
          <button
            type="button"
            onClick={() => router.push("/danas")}
            className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground"
          >
            Gotovo
          </button>
        </div>
      ) : null}
    </main>
  );
}

/**
 * One spoken item. High-variance items (cake, burek, a sandwich) show the size
 * chips inline and pulse their border — that single tap is the only thing Gric
 * ever asks of the user, and only when the answer actually moves the day's
 * total. Low-variance items stay quiet unless tapped.
 */
function GricItemCard({
  item,
  disabled,
  onSize,
  onToggle,
}: {
  item: ReviewItem;
  disabled: boolean;
  onSize: (size: PortionSizeId) => void;
  onToggle: () => void;
}) {
  const shown = current(item);
  const asks = item.base.varijansa === "visoka";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3.5 transition-opacity",
        asks ? "border-primary/50" : "border-border",
        item.removed && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate text-base font-medium text-foreground",
              item.removed && "line-through"
            )}
          >
            {shown.naziv}
          </span>
          <span className="text-xs text-muted-foreground">
            {shown.kolicina ? `${shown.kolicina} · ` : ""}
            {shown.grami} g · ≈ {shown.kcal} kcal
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={
            item.removed
              ? `Vrati ${shown.naziv}`
              : `Ukloni ${shown.naziv}`
          }
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {item.removed ? (
            <Undo2 className="size-4" aria-hidden="true" />
          ) : (
            <X className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {asks && !item.removed ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">
            Kolika je bila porcija?
          </span>
          <div className="flex gap-2">
            {PORTION_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => onSize(size.id)}
                disabled={disabled}
                aria-pressed={item.size === size.id}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                  item.size === size.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
