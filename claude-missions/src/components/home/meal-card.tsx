"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { LogAddMoreSheet } from "@/components/food/log-add-more-sheet";
import { LogDeleteConfirm } from "@/components/food/log-delete-confirm";
import { LogEditSheet } from "@/components/food/log-edit-sheet";
import { sheetPortal } from "@/components/ui/sheet-portal";
import { findMatchingCommonUnit } from "@/lib/food/portions";
import type { Food, Log } from "@/lib/types/db";
import { cn } from "@/lib/utils";

// F027 / AS-049: a single today's-meal card -- name + portion + kcal, wired
// to F026's reusable edit/delete components exactly as that feature's
// handoff instructed ("F027 should wire `<LogEditSheet log={...}
// food={...} onSaved={...} />` ... `<LogDeleteConfirm logId={...}
// logName={...} onDeleted={...} />` onto each meal card").
//
// The edit control only renders when `food` is non-null -- `LogEditSheet`
// requires a full `Food` row (per-100g values + common_units) to recompute
// a live preview; a log whose referenced food was since deleted
// (`food_id` -> null, see `src/lib/home/attach-food.ts`) can still be
// deleted (delete never needs the food), just not portion-edited.
//
// A "Slikaj obrok" log leads with its stored photo. The photo is FULL-BLEED
// to the card edges (a media card, not a picture floating inside padding) so
// it reads as polished as the rest of the app, and it is TAPPABLE: tapping it
// opens the shot full-screen in a lightbox, since the card thumbnail is too
// small to actually look at the meal you logged.
//
// The thumbnail starts gently VEILED (dimmed + blurred) and un-veils the first
// time you open it -- so the list is a calm wall of soft tiles you reveal on
// purpose, not a grid of loud photos. "Seen once" is remembered in
// `localStorage` (see the store below), so a revealed meal stays clear.

/** localStorage key holding the JSON array of log ids whose photo the user has
 * opened at least once. */
const VIEWED_KEY = "fm_viewed_meal_photos";
/** Fired when a photo is marked seen, so every mounted card re-reads the store
 * (the tapped one un-veils, and any duplicate card of the same log follows). */
const VIEWED_EVENT = "fm:meal-photo-viewed";

function readViewedSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(VIEWED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === "string"))
      : new Set();
  } catch {
    // Private mode / disabled storage: nothing is remembered, so photos simply
    // stay veiled until opened in this session -- never an error.
    return new Set();
  }
}

/** Mark one log's photo as seen and notify every mounted card. Idempotent. */
function markPhotoViewed(logId: string): void {
  try {
    const set = readViewedSet();
    if (!set.has(logId)) {
      set.add(logId);
      window.localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
    }
  } catch {
    // Couldn't persist; still notify so this session un-veils it.
  }
  window.dispatchEvent(new Event(VIEWED_EVENT));
}

/** useSyncExternalStore subscription: re-read on our own event and on cross-tab
 * `storage` changes. Client-only (never called during SSR). */
function subscribeViewed(onChange: () => void): () => void {
  window.addEventListener(VIEWED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEWED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function MealCard({
  log,
  food,
  hasPhoto = false,
  onSaved,
  onDeleted,
}: {
  log: Log;
  food: Food | null;
  // True for a "Slikaj obrok" log that has a stored photo (served from
  // `/api/obrok-slika/[logId]`, pruned after ~1 day). When set, the card leads
  // with the photo and shows the macro breakdown under the name.
  hasPhoto?: boolean;
  onSaved: (updatedLog: Log) => void;
  onDeleted: (logId: string) => void;
}) {
  // Full-screen view of the stored shot. Opened by tapping the card photo.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Whether this meal's photo has been opened before. Read from localStorage
  // through useSyncExternalStore so it stays correct across hydration (server
  // snapshot is always "not yet seen" -> veiled) without an effect-setState.
  const viewed = useSyncExternalStore(
    subscribeViewed,
    () => hasPhoto && readViewedSet().has(log.id),
    () => false
  );

  // Escape closes the lightbox (subscribe pattern: setState fires from the key
  // callback, never synchronously in the effect body).
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const unitMatch = food
    ? findMatchingCommonUnit(food.common_units, log.grams)
    : null;
  const matchedUnit =
    unitMatch && food ? food.common_units[unitMatch.unitIndex] : undefined;

  const portionLabel =
    unitMatch && matchedUnit
      ? `${unitMatch.quantity} × ${matchedUnit.label} (${log.grams} g)`
      : `${log.grams} g`;

  const photoSrc = `/api/obrok-slika/${log.id}`;

  /** Open the lightbox and, on the first open, un-veil the thumbnail for good. */
  function openPhoto() {
    if (!viewed) markPhotoViewed(log.id);
    setLightboxOpen(true);
  }

  return (
    <li
      data-testid={`meal-card-${log.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {hasPhoto ? (
        // Full-bleed, tappable. The card clips the image to its own top corners
        // (overflow-hidden above), so there is no mismatched inner radius or gap
        // -- the picture meets the card edge cleanly.
        <button
          type="button"
          onClick={openPhoto}
          aria-label={
            viewed ? `Prikaži sliku: ${log.name}` : `Otkrij sliku: ${log.name}`
          }
          data-testid={`meal-card-photo-button-${log.id}`}
          className="group relative block w-full active:opacity-95"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc}
            alt={log.name}
            data-testid={`meal-card-photo-${log.id}`}
            loading="lazy"
            className={cn(
              "h-48 w-full object-cover transition-all duration-500 ease-out",
              // Veiled until first opened: a gentle blur + dim. The slight
              // scale hides the soft transparent edge blur leaves behind.
              viewed ? "" : "scale-105 blur-[6px] opacity-70"
            )}
          />
          {/* While veiled, a single plain invitation to reveal it — the calm
              reveal is the whole point. Once revealed, the clear photo stands on
              its own (no corner badge); a tap still opens the full-screen view. */}
          {!viewed ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                Dodirni da vidiš
              </span>
            </span>
          ) : null}
        </button>
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              data-testid={`meal-card-name-${log.id}`}
              className="truncate font-semibold text-foreground"
            >
              {log.name}
            </span>
            <span
              data-testid={`meal-card-portion-${log.id}`}
              className="text-sm text-muted-foreground"
            >
              {portionLabel}
            </span>
          </div>
          <span
            data-testid={`meal-card-kcal-${log.id}`}
            className="shrink-0 text-lg font-bold tabular-nums text-foreground"
          >
            {Math.round(log.kcal)} kcal
          </span>
        </div>
        {hasPhoto ? (
          <div
            data-testid={`meal-card-macros-${log.id}`}
            className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          >
            <MacroStat label="Proteini" grams={log.protein} tone="text-macro-protein" />
            <MacroStat label="UH" grams={log.carbs} tone="text-macro-carbs" />
            <MacroStat label="Masti" grams={log.fat} tone="text-macro-fat" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {/* "Dodaj još" leads: seconds are the common follow-up action on an
              entry, while editing/deleting are corrections. Unlike "Izmeni" it
              needs no `food` row -- it grows the entry from its own snapshot, so
              it is available on AI meal entries too (which is the point). */}
          <LogAddMoreSheet log={log} onSaved={onSaved} />
          {food ? (
            <LogEditSheet log={log} food={food} onSaved={onSaved} />
          ) : null}
          <LogDeleteConfirm
            logId={log.id}
            logName={log.name}
            onDeleted={onDeleted}
          />
        </div>
      </div>

      {/* Full-screen lightbox. Portalled to <body> (same reason as the home
          sheets): the meal list lives inside the home pager's scroll container,
          where iOS Safari mispositions `position: fixed`. Tapping the backdrop
          or the ✕ closes it; the image itself swallows the tap so it stays open. */}
      {hasPhoto && lightboxOpen
        ? sheetPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Slika obroka: ${log.name}`}
              data-testid={`meal-card-photo-overlay-${log.id}`}
              onClick={() => setLightboxOpen(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Zatvori"
                data-testid={`meal-card-photo-close-${log.id}`}
                className="absolute left-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                style={{ top: "max(env(safe-area-inset-top), 1rem)" }}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoSrc}
                alt={log.name}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 text-sm font-medium text-white/90"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
              >
                {log.name}
              </span>
            </div>
          )
        : null}
    </li>
  );
}

/** One macro figure (grams + label) in the photo-meal card's breakdown row. */
function MacroStat({
  label,
  grams,
  tone,
}: {
  label: string;
  grams: number;
  tone: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-semibold tabular-nums ${tone}`}>
        {Math.round(grams)} g
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
