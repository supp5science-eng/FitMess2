"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Check, Loader2, Mic, Square, Undo2, X } from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import { useT } from "@/components/i18n/locale-provider";
import {
  MEAL_SIZED_KCAL,
  PORTION_SIZES,
  needsConfirmation,
  scaleGricItem,
  totalKcal,
  type GricItem,
  type GricListItem,
  type PortionSizeId,
} from "@/lib/ai/gric-estimate";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import type { FrequentSnack } from "@/lib/gric/frequent";
import { groupByOccasion, occasionName } from "@/lib/gric/rows";
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
//
// Items are shown BY EATING OCCASION, because that is how they will be saved:
// eggs, bacon and bread spoken in one breath are one card and will be one entry
// in "Obroci danas". The model does the grouping; the screen only has to make
// it visible and correctable — "Razdvoji" when it joined too much, "Sve je bio
// jedan obrok" when it split too much. Both are one tap, and neither is needed
// on the common path.

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
 * from the original every time instead of compounding.
 *
 * `group` starts as the model's occasion and is the only thing "Razdvoji" /
 * "Sve je bio jedan obrok" ever change — the items themselves are never
 * rewritten, so regrouping cannot lose an estimate. */
interface ReviewItem {
  base: GricListItem;
  size: PortionSizeId;
  removed: boolean;
  group: number;
}

const current = (item: ReviewItem): GricItem => scaleGricItem(item.base, item.size);

/** One occasion as rendered: its items, each carrying the index it occupies in
 * the flat state array (which is what the edit handlers address). */
type Occasion = { item: ReviewItem; index: number; group: number }[];

function toOccasions(items: ReviewItem[]): Occasion[] {
  return groupByOccasion(
    items.map((item, index) => ({ item, index, group: item.group }))
  );
}

/** Items of an occasion that are still going to be saved. */
const keptOf = (occasion: Occasion) =>
  occasion.filter((entry) => !entry.item.removed);

export function GricFlow({ frequent }: { frequent: FrequentSnack[] }) {
  const { t } = useT();
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
  // Every occasion is rendered, including one whose only item was removed —
  // otherwise the card would vanish and take its "vrati" button with it.
  const occasions = toOccasions(items);
  const activeOccasions = occasions.filter(
    (occasion) => keptOf(occasion).length > 0
  );

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
      setError(t("dodaj.mic.denied"));
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
      setError(t("dodaj.audio.processFailed"));
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
      setError(t("dodaj.gric.noFood"));
      setPhase("idle");
      return;
    }

    const review: ReviewItem[] = stavke.map((base) => ({
      base,
      size: "normalno",
      removed: false,
      group: base.grupa,
    }));
    setItems(review);
    setPhase("review");
    // Only pause for items whose portion genuinely varies. Everything else
    // saves itself — that is the whole promise of the feature.
    setCountdown(needsConfirmation(stavke) ? null : AUTOSAVE_SECONDS);
  }

  async function save(source: ReviewItem[]) {
    // Occasion ids are renumbered from zero on the way out: splitting invents
    // ids to keep them unique on screen, and the wire format only has to say
    // WHICH items belong together, not what they were called while editing.
    const groupIds = new Map<number, number>();
    const occasionId = (group: number) => {
      const existing = groupIds.get(group);
      if (existing !== undefined) return existing;
      const next = groupIds.size;
      groupIds.set(group, next);
      return next;
    };

    const payload = source
      .filter((item) => !item.removed)
      .map((item) => {
        const scaled = current(item);
        return {
          name: scaled.naziv,
          // The spoken amount travels along so the server can work out the
          // natural unit of this part ("2 komada" of 100 g = one 50 g piece).
          amount: scaled.kolicina || undefined,
          grams: scaled.grami,
          kcal: scaled.kcal,
          protein: scaled.protein_g,
          carbs: scaled.uh_g,
          fat: scaled.mast_g,
          group: occasionId(item.group),
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

  /** "Razdvoji": the model put these on one plate, the user says they weren't.
   * Each item becomes its own occasion, so each becomes its own entry. */
  function splitOccasion(group: number) {
    stopCountdown();
    setItems((prev) => {
      let next = Math.max(...prev.map((item) => item.group)) + 1;
      return prev.map((item) =>
        item.group === group ? { ...item, group: next++ } : item
      );
    });
  }

  /** "Sve je bio jedan obrok": the opposite correction — everything spoken in
   * this clip was in fact one sitting, so it becomes one entry. */
  function mergeAll() {
    stopCountdown();
    setItems((prev) => prev.map((item) => ({ ...item, group: 0 })));
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
          {t("dodaj.gric.title")}
        </h1>
        <Link
          href="/danas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("dodaj.cancel")}
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
              aria-label={t("dodaj.startRecording")}
              className="flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            >
              <Mic className="size-11" aria-hidden="true" />
            </button>
            <div className="flex flex-col gap-1">
              <span className="text-base font-medium text-foreground">
                {t("dodaj.gric.prompt")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("dodaj.gric.hint")}
              </span>
            </div>
          </div>

          {frequent.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("dodaj.gric.again")}
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
                {t("dodaj.gric.oneTapHint")}
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
            aria-label={t("dodaj.stopRecording")}
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
              {t("dodaj.gric.listening")}
            </span>
          </div>
        </div>
      ) : null}

      {phase === "estimating" ? (
        <AiThinking
          title={t("dodaj.listenCalc.title")}
          lines={[
            t("dodaj.gric.thinking.line1"),
            t("dodaj.gric.thinking.line2"),
            t("dodaj.gric.thinking.line3"),
          ]}
        />
      ) : null}

      {(phase === "review" || phase === "saving") && items.length > 0 ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {occasions.map((occasion) => (
              <OccasionCard
                key={`obrok-${occasion[0].group}`}
                occasion={occasion}
                disabled={phase === "saving"}
                onSize={setSize}
                onToggle={toggleRemoved}
                onSplit={() => splitOccasion(occasion[0].group)}
              />
            ))}
          </div>

          {activeOccasions.length > 1 ? (
            <button
              type="button"
              onClick={mergeAll}
              disabled={phase === "saving"}
              className="self-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60"
            >
              {t("dodaj.gric.mergeAll")}
            </button>
          ) : null}

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{t("dodaj.total")}</span>
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
              ? t("dodaj.gric.addingIn", { count: countdown })
              : t("dodaj.addToDay")}
          </button>

          {countdown !== null && phase === "review" ? (
            <button
              type="button"
              onClick={stopCountdown}
              className="text-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("dodaj.gric.waitAdjust")}
            </button>
          ) : (
            <button
              type="button"
              onClick={resetToIdle}
              disabled={phase === "saving"}
              className="text-center text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {t("dodaj.recordAgain")}
            </button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {t("dodaj.gric.approxNote")}
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
              {t("dodaj.gric.saved", { kcal: savedKcal })}
            </span>
            <p className="text-sm text-muted-foreground">
              {t("dodaj.gric.realMeal")}
            </p>
          </div>
          <Link
            href="/dodaj/obrok"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-base font-medium text-foreground"
          >
            <Camera className="size-5" aria-hidden="true" />
            {t("dodaj.meal.title")}
          </Link>
          <button
            type="button"
            onClick={() => router.push("/danas")}
            className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("dodaj.done")}
          </button>
        </div>
      ) : null}
    </main>
  );
}

/**
 * One eating occasion — one card, and one future entry in "Obroci danas".
 *
 * A single-item occasion looks exactly as it always did (the common case must
 * not get heavier). Several items get a header with the joined name and the
 * occasion's kcal, so what the user reads here is what the day will show, plus
 * one quiet "Razdvoji" for when the model joined things that were not one meal.
 */
function OccasionCard({
  occasion,
  disabled,
  onSize,
  onToggle,
  onSplit,
}: {
  occasion: Occasion;
  disabled: boolean;
  onSize: (index: number, size: PortionSizeId) => void;
  onToggle: (index: number) => void;
  onSplit: () => void;
}) {
  const { t } = useT();
  const remaining = keptOf(occasion);
  const joined = remaining.length > 1;
  const asks = occasion.some(
    (entry) => !entry.item.removed && entry.item.base.varijansa === "visoka"
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3.5 transition-opacity",
        asks ? "border-primary/50" : "border-border",
        remaining.length === 0 && "opacity-40"
      )}
    >
      {joined ? (
        <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2.5">
          <span className="min-w-0 truncate text-base font-semibold text-foreground">
            {occasionName(remaining.map((entry) => current(entry.item).naziv))}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            ≈ {totalKcal(remaining.map((entry) => current(entry.item)))} kcal
          </span>
        </div>
      ) : null}

      {occasion.map((entry) => (
        <GricItemRow
          key={`${entry.item.base.naziv}-${entry.index}`}
          item={entry.item}
          compact={joined}
          disabled={disabled}
          onSize={(size) => onSize(entry.index, size)}
          onToggle={() => onToggle(entry.index)}
        />
      ))}

      {joined ? (
        <button
          type="button"
          onClick={onSplit}
          disabled={disabled}
          className="self-start text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60"
        >
          {t("dodaj.gric.split")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * One spoken item. High-variance items (cake, burek, a sandwich) show the size
 * chips inline — that single tap is the only thing Gric ever asks of the user,
 * and only when the answer actually moves the day's total. Low-variance items
 * stay quiet unless tapped.
 */
function GricItemRow({
  item,
  compact,
  disabled,
  onSize,
  onToggle,
}: {
  item: ReviewItem;
  /** Inside a joined occasion the item is a part of a meal, not the meal —
   * so it steps down a size and the header above carries the name. */
  compact: boolean;
  disabled: boolean;
  onSize: (size: PortionSizeId) => void;
  onToggle: () => void;
}) {
  const { t } = useT();
  const shown = current(item);
  const asks = item.base.varijansa === "visoka";

  return (
    // No opacity of its own: a lone removed item already fades with its card,
    // and inside a joined one the strike-through is the signal.
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate font-medium text-foreground",
              compact ? "text-sm" : "text-base",
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
              ? t("dodaj.gric.restore", { name: shown.naziv })
              : t("dodaj.gric.remove", { name: shown.naziv })
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
            {t("dodaj.gric.portionQuestion")}
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
