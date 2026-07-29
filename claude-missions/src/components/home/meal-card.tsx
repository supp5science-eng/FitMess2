"use client";

import { useEffect, useState } from "react";
import { Expand, X } from "lucide-react";

import { LogAddMoreSheet } from "@/components/food/log-add-more-sheet";
import { LogDeleteConfirm } from "@/components/food/log-delete-confirm";
import { LogEditSheet } from "@/components/food/log-edit-sheet";
import { sheetPortal } from "@/components/ui/sheet-portal";
import { findMatchingCommonUnit } from "@/lib/food/portions";
import type { Food, Log } from "@/lib/types/db";

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
          onClick={() => setLightboxOpen(true)}
          aria-label={`Prikaži sliku: ${log.name}`}
          data-testid={`meal-card-photo-button-${log.id}`}
          className="group relative block w-full active:opacity-95"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc}
            alt={log.name}
            data-testid={`meal-card-photo-${log.id}`}
            loading="lazy"
            className="h-48 w-full object-cover"
          />
          {/* A soft top scrim so the expand badge stays legible over a bright
              photo (scrim over image content, not a themed surface). */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/25 to-transparent"
          />
          {/* The affordance: a little "tap to enlarge" chip in the corner. */}
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform group-active:scale-95"
          >
            <Expand className="size-4" />
          </span>
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
                className="absolute right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
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
