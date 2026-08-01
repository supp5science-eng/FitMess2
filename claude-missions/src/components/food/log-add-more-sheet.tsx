"use client";

import { Loader2, Minus, PenLine, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCountUp } from "@/components/home/animated-number";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { foldSerbian, foodEmoji } from "@/lib/food/emoji";
import {
  applyAddMore,
  componentPieceCount,
  MAX_UNITS,
  readComponents,
  type AddMoreSelection,
} from "@/lib/log/add-more";
import {
  MAX_EXTRA_AMOUNT,
  MAX_EXTRA_DESCRIPTION,
} from "@/lib/ai/extra-limits";
import { isAiExtraId, type ExtraFood } from "@/lib/log/extras";
import { formatUnitCount } from "@/lib/log/units-sr";
import type { TFunction } from "@/lib/i18n/translate";
import type { Log, LogComponentSnapshot } from "@/lib/types/db";

// "Dodaj još" (2026-07-25): the sheet that lets you eat seconds without
// photographing them.
//
// The design problem is that "I ate one more wafer" and "I went back for two
// more eggs and a spoon of sour cream" are the same intention at different
// resolutions, and the second one must not make the first one slower. So the
// sheet opens ALREADY ANSWERING the common case -- on an entry with no parts,
// "još 1" is pre-selected and the interaction is open → "Dodaj" -- while an
// itemised meal gets a stepper per food, starting at zero, because there the
// user does have something specific to say.
//
// Entries logged before 0019 (and everything from the catalog / Gric / voice)
// carry no breakdown, which would leave the feature able only to DOUBLE those
// meals. So the sheet asks for one on open (`POST /api/logs/[id]/razlozi`,
// once per entry, cached onto the row) rather than waiting for the user to
// photograph that meal again some other day. If the split fails, the sheet
// degrades to whole-entry seconds instead of blocking.
//
// The tone is doing real work here. This screen is read mid-snack, in the two
// seconds between "I ate another one" and putting the phone down, so it speaks
// in the user's own words -- "u obroku: 6 jaja", "+2 jajeta" -- rather than in
// grams and rows. That is also why the unit forms go through `units-sr.ts`
// instead of a naive "2 jaje": getting the grammar right is most of what makes
// software feel like it was written by a person who eats.
//
// The preview runs `applyAddMore`, the exact function the server re-runs
// against the stored row (`src/app/api/logs/[id]/dodaj/route.ts`) -- same
// guarantee as F026's edit sheet: what you see added is what gets written. For
// catalog picks only unit counts go over the wire; a written-in extra carries
// the figures our own estimate endpoint produced (see `aiExtraFoodSchema`).
//
// (2026-08-01) The extras row lost its catalog search. Searching 350 curated
// foods for "tartar sos" answers "nema u katalogu", which teaches people the
// feature doesn't work and leaves the calories unlogged -- so the box now takes
// what the user WRITES plus how much of it, and asks the model
// (`POST /api/dodaci/opis`). Anything sayable is loggable.

interface LogResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: Log;
}

/** What `POST /api/dodaci/opis` answers with: a food shaped exactly like a
 * catalog chip, how many units the description worked out to, and the one-line
 * assumption behind it. */
interface ExtraEstimateBody {
  ok: boolean;
  error_sr?: string;
  data?: { food: ExtraFood; units: number; napomena?: string };
}

type Phase = "idle" | "splitting" | "saving";

/** An extra the user has tapped, and how many units of it. Kept as a list so
 * the promoted rows stay in the order they were added -- a row that reorders
 * itself under the thumb is how you tap the wrong `+`. */
interface ExtraPick {
  food: ExtraFood;
  units: number;
}

export function LogAddMoreSheet({
  log,
  onSaved,
}: {
  log: Log;
  /** Called with the grown log row, so the day's ring/macros recompute. */
  onSaved?: (updatedLog: Log) => void;
}) {
  const { t } = useT();
  // The entry as the sheet currently knows it: the prop, then whatever the
  // split returns (the row gains `components` without its totals changing).
  const [entry, setEntry] = useState<Log>(log);
  const components = useMemo(
    () => readComponents(entry.components),
    [entry.components]
  );
  const hasBreakdown = components.length > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [whole, setWhole] = useState(0);
  const [units, setUnits] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [splitNote, setSplitNote] = useState<string | undefined>(undefined);

  // "Nije bilo na slici": the curated chips, plus whatever the user has tapped.
  const [extraCatalog, setExtraCatalog] = useState<ExtraFood[]>([]);
  const [extraPicks, setExtraPicks] = useState<ExtraPick[]>([]);
  // "Napiši šta si još pojeo/la": the free-text box that replaced search.
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [writeAmount, setWriteAmount] = useState("");
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | undefined>(undefined);
  /** The model's one-line assumption for the last thing written in ("kašika
   * majoneza ≈ 15 g"). Shown once, because an estimate that says what it
   * guessed is one the user can actually correct with the stepper. */
  const [writeNote, setWriteNote] = useState<string | undefined>(undefined);

  const selection = useMemo<AddMoreSelection>(
    () => ({
      whole,
      components: units
        .map((value, index) => ({ index, units: value }))
        .filter((pick) => pick.units > 0),
      extras: extraPicks.map((pick) => ({
        foodId: pick.food.id,
        units: pick.units,
      })),
      // Only the written-in ones travel with their numbers; catalog picks are
      // re-read from `foods` server-side and must not be client-authored.
      ai_dodaci: extraPicks
        .filter((pick) => isAiExtraId(pick.food.id))
        .map((pick) => pick.food),
    }),
    [whole, units, extraPicks]
  );

  const pickedFoods = useMemo(
    () => extraPicks.map((pick) => pick.food),
    [extraPicks]
  );

  const preview = useMemo(
    () => applyAddMore(entry, selection, pickedFoods),
    [entry, selection, pickedFoods]
  );
  // Tweens on every change of the added figure, so the number visibly RESPONDS
  // to each tap instead of jumping -- the tap and the consequence read as one
  // motion.
  const shownKcal = Math.round(useCountUp(preview.addedKcal, preview.addedKcal, 260));

  /** The chips under the steppers: what is about to be added, in words. */
  const additions = useMemo(() => {
    const picked = components
      .map((component, index) => ({ component, count: units[index] ?? 0 }))
      .filter((entryPick) => entryPick.count > 0)
      .map(({ component, count }) =>
        formatUnitCount(count, component.kom_naziv) === String(count)
          ? `${count} × ${component.naziv}`
          : formatUnitCount(count, component.kom_naziv)
      );
    if (whole > 0) {
      picked.unshift(
        whole === 1
          ? t("food.addMore.wholeMeal")
          : t("food.addMore.wholeMealMultiple", { count: whole })
      );
    }
    // "2 kašike majoneza" when we know the genitive, "2 kašike · Tartar" when
    // the food came from search and we don't -- plain beats confidently wrong.
    for (const pick of extraPicks) {
      const amount = formatUnitCount(pick.units, pick.food.unit_label);
      picked.push(
        pick.food.of ? `${amount} ${pick.food.of}` : `${amount} · ${pick.food.label}`
      );
    }
    return picked;
  }, [components, units, whole, extraPicks, t]);

  async function openSheet() {
    setUnits(components.map(() => 0));
    setErrorMessage(undefined);
    setSplitNote(undefined);
    setExtraPicks([]);
    setWriteOpen(false);
    setWriteText("");
    setWriteAmount("");
    setWriteError(undefined);
    setWriteNote(undefined);
    setIsOpen(true);

    // Chips load alongside the split rather than after it: they are catalog
    // reads with nothing to wait for, and the row must be there the moment the
    // user looks past the steppers. A failure leaves the row empty and silent.
    if (extraCatalog.length === 0) {
      void (async () => {
        try {
          const response = await fetch("/api/dodaci");
          const body = (await response.json()) as {
            ok: boolean;
            data?: ExtraFood[];
          };
          if (body.ok && Array.isArray(body.data)) setExtraCatalog(body.data);
        } catch {
          // Silent: the steppers are the feature, the chips are the shortcut.
        }
      })();
    }

    if (hasBreakdown) {
      setWhole(0);
      setPhase("idle");
      return;
    }

    // No breakdown yet: ask for one. "Ceo obrok" stays at 0 while we wait so a
    // fast tapper can't confirm a doubling they didn't mean; it falls back to 1
    // only if the split doesn't arrive.
    setWhole(0);
    setPhase("splitting");
    try {
      const response = await fetch(`/api/logs/${entry.id}/razlozi`, {
        method: "POST",
      });
      const body = (await response.json()) as LogResponseBody;
      const split = body.ok && body.data ? readComponents(body.data.components) : [];

      if (split.length > 0 && body.data) {
        setEntry(body.data);
        setUnits(split.map(() => 0));
      } else {
        setWhole(1);
        setSplitNote(t("food.addMore.splitNote"));
      }
    } catch {
      setWhole(1);
      setSplitNote(t("food.addMore.splitNote"));
    } finally {
      setPhase("idle");
    }
  }

  function closeSheet() {
    // Mid-write is the one moment closing would be a lie: the row is already
    // being changed on the server. Every other state, including the split, is
    // safely abandonable.
    if (phase === "saving") return;
    setIsOpen(false);
  }

  // Escape closes it too. A sheet you can only leave through one button at the
  // bottom reads as a trap -- tapping the dimmed area above it is what people
  // try first, and it must work.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function stepWhole(delta: number) {
    setWhole((current) => Math.min(Math.max(current + delta, 0), MAX_UNITS));
    setErrorMessage(undefined);
  }

  function stepComponent(index: number, delta: number) {
    setUnits((current) =>
      current.map((value, i) =>
        i === index ? Math.min(Math.max(value + delta, 0), MAX_UNITS) : value
      )
    );
    setErrorMessage(undefined);
  }

  /** Tapping a chip promotes it into a stepper row at one unit. Tapping it back
   * down to zero removes the row and returns the chip -- the gesture is
   * reversible, so nothing about it needs a confirmation. */
  function stepExtra(food: ExtraFood, delta: number) {
    setExtraPicks((current) => {
      const at = current.findIndex((pick) => pick.food.id === food.id);
      if (at === -1) {
        return delta > 0 ? [...current, { food, units: 1 }] : current;
      }
      const next = Math.min(Math.max(current[at].units + delta, 0), MAX_UNITS);
      if (next === 0) return current.filter((_, i) => i !== at);
      return current.map((pick, i) => (i === at ? { ...pick, units: next } : pick));
    });
    setErrorMessage(undefined);
  }

  /**
   * The written-in extra: one estimate call, straight into a stepper row.
   *
   * Deliberately explicit ("Izračunaj") rather than as-you-type: every call
   * costs money and the user is mid-sentence for most of the typing. The
   * amount box is optional -- an empty one means "a normal serving", which the
   * model is asked to assume out loud and which then shows up as the note.
   */
  async function estimateWritten() {
    const opis = writeText.trim();
    if (opis.length < 2 || writeBusy) return;
    setWriteBusy(true);
    setWriteError(undefined);
    setWriteNote(undefined);
    try {
      const response = await fetch("/api/dodaci/opis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opis, kolicina: writeAmount.trim() }),
      });
      const body = (await response.json()) as ExtraEstimateBody;
      if (!response.ok || !body.ok || !body.data) {
        setWriteError(body.error_sr || t("food.addMore.extrasWriteFailed"));
        return;
      }
      const { food, units: estimatedUnits, napomena } = body.data;
      // Straight into the same promoted-row list a chip lands in: from here on
      // there is nothing special about a written-in extra.
      setExtraPicks((current) => [
        ...current,
        { food, units: Math.min(Math.max(estimatedUnits, 1), MAX_UNITS) },
      ]);
      setWriteNote(napomena?.trim() || undefined);
      setWriteOpen(false);
      setWriteText("");
      setWriteAmount("");
      setErrorMessage(undefined);
    } catch {
      setWriteError(t("food.addMore.extrasWriteFailed"));
    } finally {
      setWriteBusy(false);
    }
  }

  /**
   * Chips worth showing: not already promoted to a row, and not already part of
   * the meal. A chip for bread on a meal whose breakdown already has a bread
   * line would give the user two different controls for one food -- the
   * stepper above is the right one, so the chip steps aside.
   */
  const availableChips = useMemo(() => {
    const pickedIds = new Set(extraPicks.map((pick) => pick.food.id));
    // Empty names are dropped: `"".includes(anything)` is false but
    // `anything.includes("")` is TRUE, which would hide every chip.
    const inMeal = components
      .map((component) => foldSerbian(component.naziv))
      .filter((naziv) => naziv.length > 0);
    return extraCatalog.filter((food) => {
      if (pickedIds.has(food.id)) return false;
      const chip = foldSerbian(food.label);
      if (!chip) return true;
      return !inMeal.some((naziv) => naziv.includes(chip) || chip.includes(naziv));
    });
  }, [extraCatalog, extraPicks, components]);

  const canConfirm = !preview.isEmpty && phase === "idle";

  async function onConfirm() {
    if (!canConfirm) return;
    setPhase("saving");
    setErrorMessage(undefined);
    try {
      const response = await fetch(`/api/logs/${entry.id}/dodaj`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selection),
      });
      const body = (await response.json()) as LogResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setPhase("idle");
        setErrorMessage(body.error_sr || t("food.addMore.saveError"));
        return;
      }

      setEntry(body.data);
      setPhase("idle");
      onSaved?.(body.data);
      setIsOpen(false);
    } catch {
      setPhase("idle");
      setErrorMessage(t("food.addMore.saveError"));
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={openSheet}
        data-testid={`log-add-more-open-${log.id}`}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("food.addMore.open")}
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 backdrop-blur-[2px] sm:items-center sm:px-6"
          data-testid="log-add-more-overlay"
          // Tap anywhere on the dimmed area to dismiss. Guarded by the target
          // check so a tap that lands on the panel (and bubbles up here) never
          // closes it.
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-add-more-title"
            data-testid="log-add-more-sheet"
            className="flex max-h-[88vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-t-3xl border border-border bg-background px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-3xl sm:pb-7"
          >
            {/* Grab handle: tells the thumb this panel belongs to the bottom of
                the screen, the same way every native sheet does. */}
            <div
              aria-hidden="true"
              className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            />

            <header className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl"
              >
                {foodEmoji(entry.name)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <h2
                  id="log-add-more-title"
                  className="line-clamp-2 text-base font-semibold text-foreground"
                >
                  {entry.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("food.addMore.soFar", {
                    kcal: Math.round(entry.kcal),
                    grams: Math.round(entry.grams),
                  })}
                </p>
              </div>
              {/* A visible way out. Tapping the dimmed area and Escape both
                  already closed the sheet, but neither is visible -- on a phone
                  the only thing that reads as "I can leave" is an X, and
                  "Otkaži" sits below the fold once the chips are open. */}
              <button
                type="button"
                onClick={closeSheet}
                disabled={phase === "saving"}
                aria-label={t("food.addMore.close")}
                data-testid="log-add-more-close"
                className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-foreground/10 disabled:opacity-30"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            {phase === "splitting" ? (
              // The wait is ~2 s of nothing, and "Gledamo od čega se sastoji"
              // alone did not tell the user WHAT was about to appear. So the
              // loading state is shaped like the answer: placeholder rows in
              // the exact geometry of the steppers that replace them, shimmering
              // in sequence. Nothing moves position when the real list lands.
              <div
                data-testid="log-add-more-splitting"
                className="flex flex-col gap-2"
                role="status"
                aria-live="polite"
              >
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="size-1.5 animate-ping rounded-full bg-primary" />
                  {t("food.addMore.splitting")}
                </p>
                <SkeletonRow delay="0ms" nameWidth="w-24" />
                <SkeletonRow delay="140ms" nameWidth="w-32" />
                <SkeletonRow delay="280ms" nameWidth="w-20" />
                <p className="px-1 text-xs text-muted-foreground">
                  {t("food.addMore.splittingHint")}
                </p>
              </div>
            ) : (
              <>
                {hasBreakdown ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("food.addMore.howMuchMore")}
                    </p>
                    {components.map((component, index) => (
                      <StepperRow
                        key={`${component.naziv}-${index}`}
                        testId={`log-add-more-component-${index}`}
                        label={capitalize(component.naziv)}
                        detail={t("food.addMore.inMeal", {
                          amount: describeAmount(component),
                        })}
                        stepHint={stepHint(component)}
                        value={units[index] ?? 0}
                        onStep={(delta) => stepComponent(index, delta)}
                        t={t}
                      />
                    ))}
                  </div>
                ) : null}

                {/* A one-food entry (a wafer, an apple) has a single part that
                    IS the whole entry, so a separate "Ceo obrok" row would be
                    the same stepper twice. */}
                {components.length === 1 ? null : (
                  <StepperRow
                    testId="log-add-more-whole"
                    label={
                      hasBreakdown
                        ? t("food.addMore.wholeAgain")
                        : t("food.addMore.sameAgain")
                    }
                    detail={`${Math.round(entry.kcal)} kcal · ${Math.round(
                      entry.grams
                    )} g`}
                    stepHint={null}
                    value={whole}
                    onStep={stepWhole}
                    t={t}
                  />
                )}

                {splitNote ? (
                  <p
                    data-testid="log-add-more-split-note"
                    className="text-xs text-muted-foreground"
                  >
                    {splitNote}
                  </p>
                ) : null}

                {/* "Nije bilo na slici" -- the half of the problem the steppers
                    above cannot express. Kept BELOW them because adding more of
                    what you photographed is the common case; this is the one
                    that saves the meal from being quietly wrong. */}
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("food.addMore.extrasHeading")}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      {t("food.addMore.extrasHint")}
                    </p>
                  </div>

                  {/* Promoted picks: a tapped chip becomes a full stepper row,
                      identical to the meal's own parts, so "one more spoon"
                      is the same gesture wherever the food came from. */}
                  {extraPicks.map((pick) => (
                    <StepperRow
                      key={pick.food.id}
                      testId={`log-add-more-extra-${pick.food.id}`}
                      label={`${pick.food.emoji} ${pick.food.label}`}
                      detail={t("food.addMore.extrasPerUnit", {
                        unit: `1 ${pick.food.unit_label} · ${Math.round(
                          pick.food.unit_grams
                        )} g`,
                        kcal: Math.round(
                          (pick.food.kcal_100g * pick.food.unit_grams) / 100
                        ),
                      })}
                      stepHint={null}
                      value={pick.units}
                      onStep={(delta) => stepExtra(pick.food, delta)}
                      t={t}
                    />
                  ))}

                  <div className="flex flex-wrap gap-1.5">
                    {availableChips.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        data-testid={`log-add-more-chip-${food.id}`}
                        onClick={() => stepExtra(food, 1)}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors active:border-primary/50 active:bg-primary/10"
                      >
                        <span aria-hidden="true">{food.emoji}</span>
                        {food.label}
                      </button>
                    ))}

                    {/* Anything that isn't one of the chips. Not a search box:
                        the catalog is 350 foods and "nema u katalogu" is how a
                        snack ends up unlogged. */}
                    <button
                      type="button"
                      data-testid="log-add-more-write-toggle"
                      aria-expanded={writeOpen}
                      onClick={() => {
                        setWriteOpen((open) => !open);
                        setWriteError(undefined);
                      }}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                        writeOpen
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-dashed border-border bg-transparent text-muted-foreground"
                      }`}
                    >
                      <PenLine className="size-3.5" aria-hidden="true" />
                      {t("food.addMore.extrasWrite")}
                    </button>
                  </div>

                  {/* What the estimate assumed, once, under the row it just
                      created -- so "2 kašike" that should have been one is a
                      single tap on "−" away. */}
                  {writeNote && !writeOpen ? (
                    <p
                      data-testid="log-add-more-write-note"
                      className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground"
                    >
                      <Sparkles
                        className="mt-0.5 size-3 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {writeNote}
                    </p>
                  ) : null}

                  {writeOpen ? (
                    <div className="flex flex-col gap-2">
                      <p className="px-1 text-xs text-muted-foreground">
                        {t("food.addMore.extrasWriteHint")}
                      </p>
                      <input
                        type="text"
                        autoFocus
                        value={writeText}
                        onChange={(event) => {
                          setWriteText(event.target.value);
                          setWriteError(undefined);
                        }}
                        // Enter from either box submits: this is a two-field
                        // form, and reaching for a button after typing three
                        // words is exactly the friction the chips avoid.
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void estimateWritten();
                          }
                        }}
                        maxLength={MAX_EXTRA_DESCRIPTION}
                        aria-label={t("food.addMore.extrasWriteLabel")}
                        placeholder={t("food.addMore.extrasWritePlaceholder")}
                        data-testid="log-add-more-write-input"
                        // 16px keeps iOS from zooming the whole sheet on focus.
                        className="w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
                      />
                      <div className="flex items-stretch gap-2">
                        <input
                          type="text"
                          value={writeAmount}
                          onChange={(event) => setWriteAmount(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void estimateWritten();
                            }
                          }}
                          maxLength={MAX_EXTRA_AMOUNT}
                          aria-label={t("food.addMore.extrasAmountLabel")}
                          placeholder={t("food.addMore.extrasAmountPlaceholder")}
                          data-testid="log-add-more-write-amount"
                          className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
                        />
                        <button
                          type="button"
                          onClick={() => void estimateWritten()}
                          disabled={writeText.trim().length < 2 || writeBusy}
                          data-testid="log-add-more-write-submit"
                          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
                        >
                          {writeBusy ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Sparkles className="size-4" aria-hidden="true" />
                          )}
                          {writeBusy
                            ? t("food.addMore.extrasEstimating")
                            : t("food.addMore.extrasEstimate")}
                        </button>
                      </div>
                      {writeError ? (
                        <p
                          role="alert"
                          data-testid="log-add-more-write-error"
                          className="px-1 text-xs font-medium text-destructive"
                        >
                          {writeError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}

            <div
              data-testid="log-add-more-preview"
              className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition-colors ${
                preview.isEmpty
                  ? "border-border bg-card"
                  : "border-primary/40 bg-primary/[0.07]"
              }`}
            >
              {additions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {additions.map((text) => (
                    <span
                      key={text}
                      className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      +{text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("food.addMore.emptyHint")}
                </p>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <span
                  data-testid="log-add-more-preview-kcal"
                  className={`text-3xl font-bold tabular-nums ${
                    preview.isEmpty ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  +{shownKcal}
                  <span className="ml-1 text-base font-semibold">kcal</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("food.addMore.mealBecomes", { kcal: preview.totals.kcal })}
                </span>
              </div>
            </div>

            {errorMessage ? (
              <p
                role="alert"
                data-testid="log-add-more-error"
                className="text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeSheet}
                disabled={phase === "saving"}
                data-testid="log-add-more-cancel"
                className="flex-1"
              >
                {t("food.cancel")}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                data-testid="log-add-more-save"
                className="flex-[1.6]"
              >
                {phase === "saving"
                  ? t("food.addMore.saving")
                  : t("food.addMore.add")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The model returns part names in running-text case ("jaja", "kisela
 * pavlaka"); as a standalone row title that reads like an unfinished sentence,
 * so it gets a capital. Only the first letter -- "Kisela Pavlaka" would be
 * English title case, which Serbian doesn't use.
 */
function capitalize(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("sr-Latn") + trimmed.slice(1);
}

/**
 * A placeholder in the exact shape of a `StepperRow`, so the loading state
 * previews its own answer instead of just saying "wait". The staggered delay
 * makes the group read as one calm sweep rather than three things blinking.
 */
function SkeletonRow({
  delay,
  nameWidth,
}: {
  delay: string;
  nameWidth: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2.5"
      style={{ animationDelay: delay }}
    >
      <div className="flex flex-col gap-1.5">
        <span className={`block h-3.5 rounded-full bg-muted-foreground/25 ${nameWidth}`} />
        <span className="block h-2.5 w-28 rounded-full bg-muted-foreground/15" />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="block size-10 rounded-full border border-border" />
        <span className="block h-4 w-3 rounded-full bg-muted-foreground/15" />
        <span className="block size-10 rounded-full bg-muted-foreground/20" />
      </div>
    </div>
  );
}

/** "6 jaja" when the food has a natural unit, plain grams when it doesn't. */
function describeAmount(component: LogComponentSnapshot): string {
  const count = componentPieceCount(component);
  const unitName = (component.kom_naziv ?? "").trim();
  if (count && unitName) return formatUnitCount(count, unitName);
  return `${Math.round(component.grami)} g`;
}

/** What one tap of "+" adds, said the way the user would say it. */
function stepHint(component: LogComponentSnapshot): string | null {
  const unitName = (component.kom_naziv ?? "").trim();
  const unitGrams = component.kom_grami ?? 0;
  if (!unitName || unitGrams <= 0) return null;
  return `+1 ${unitName}`;
}

/** One "− 0 +" row. Big round targets: this is a one-handed, mid-meal control. */
function StepperRow({
  testId,
  label,
  detail,
  stepHint: hint,
  value,
  onStep,
  t,
}: {
  testId: string;
  label: string;
  detail: string;
  stepHint: string | null;
  value: number;
  onStep: (delta: number) => void;
  t: TFunction;
}) {
  const active = value > 0;
  return (
    <div
      data-testid={testId}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
        active ? "border-primary/50 bg-primary/[0.07]" : "border-border bg-card"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {detail}
          {hint ? <span className="text-primary"> · {hint}</span> : null}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={t("food.addMore.decrease", { label })}
          data-testid={`${testId}-minus`}
          onClick={() => onStep(-1)}
          disabled={value === 0}
          className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-opacity disabled:opacity-25"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span
          data-testid={`${testId}-value`}
          className={`w-7 text-center text-lg font-bold tabular-nums ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={t("food.addMore.increase", { label })}
          data-testid={`${testId}-plus`}
          onClick={() => onStep(1)}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
