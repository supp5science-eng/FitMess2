"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Camera,
  Cookie,
  Dumbbell,
  Plus,
  Target,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// F028 / AS-051: "From the home screen, starting any of the logging methods
// takes at most 2 taps." A floating "+" button (tap 1) opens a bottom sheet
// listing every logging method; each row is a real `next/link` navigation
// (tap 2), so every method -- including the ones not built yet -- is
// reachable in exactly 2 taps, never more.
//
// Same "no shadcn Sheet/Dialog primitive exists in this codebase" overlay
// pattern F026's `LogEditSheet`/`LogDeleteConfirm` and F019's
// `DeleteAccountDialog` already established: `fixed inset-0` backdrop +
// `role="dialog"` sheet, self-contained trigger + open state so the caller
// (`HomeScreen`) can drop `<AddSheet />` in without managing any state
// itself.
//
// Every option in this menu is live: there are no "uskoro" (coming soon) rows
// left, so the sheet no longer carries an `available` flag or a gray "Uskoro"
// badge. If a future method needs to be announced before it is built, that
// pattern comes back with it.

interface AddSheetOption {
  key: string;
  label: string;
  icon: typeof Camera;
  href: string;
  /** Optional muted helper line under the label. */
  description?: string;
  /** Optional short badge naming what this method is BEST at ("NAJTAČNIJE" /
   * "NAJBRŽE"). Two methods carry one, so they need different weights -- see
   * `badgeTone`. */
  badge?: string;
  /** How loudly the row is drawn. Both badged methods get a teal tint so they
   * read as a matched pair standing apart from the plain rows -- but the two
   * tints are deliberately far apart in strength, not neighbouring shades:
   * "accent" (Prizma) is the one the menu recommends, "soft" only whispers.
   * Defaults to "soft" so only a deliberate choice can shout. */
  badgeTone?: "accent" | "soft";
}

// "Pretraži" (catalog search) and "Dodaj proizvod" (manual product create) were
// intentionally removed from this menu -- the app is photo/voice-first, so those
// two entry points are no longer offered here. Their routes still EXIST as
// hidden fallbacks (the barcode scanner's "manual search" escape hatch, the
// portion flow, etc.), so nothing breaks; they're just no longer advertised.
//
// "Prizma" and "Gric" are product/feature names kept as-is in both languages.
function buildOptions(t: TFunction): AddSheetOption[] {
  return [
    // The highest-accuracy path (guided two angles + the AI's own questions)
    // leads the menu and carries a teal "NAJTAČNIJE" badge to draw people to it.
    {
      key: "najtacnije",
      label: "Prizma",
      icon: Target,
      href: "/dodaj/najtacnije",
      // Says what you GET, not how it works -- the guided two-angle mechanic is
      // left for the flow itself to reveal (spelled out here it reads as effort
      // before anyone has seen the payoff). The number is the promise.
      // NOTE: 92% is a marketing figure, not a measured one. If we ever publish
      // it outside this row, back it with a real benchmark first.
      description: t("home.addSheet.prizmaDesc"),
      badge: t("home.addSheet.badge.mostAccurate"),
      badgeTone: "accent",
    },
    // The other half of the pair: Prizma buys accuracy with effort, this one buys
    // speed with a single tap of the shutter. Naming both makes the trade-off the
    // menu's actual content -- you pick by what you need right now, not by
    // guessing what the labels mean.
    {
      key: "obrok",
      label: t("home.addSheet.meal"),
      icon: UtensilsCrossed,
      href: "/dodaj/obrok",
      description: t("home.addSheet.mealDesc"),
      badge: t("home.addSheet.badge.fastest"),
    },
    // "Reci obrok" (`/dodaj/glas`) was removed from this menu: "Gric" below
    // already covers speaking your food, and two microphone rows just made people
    // stop and compare. The route still exists, it is simply no longer offered.
    //
    // "Gric" sits below the two photographed MEAL methods because it answers a
    // different question: not "how do I log this meal accurately" but "how do I
    // log this at all". A cucumber costs more to photograph than it is worth, so
    // it goes unlogged and the day's total quietly reads too low.
    {
      key: "gric",
      label: "Gric",
      icon: Cookie,
      href: "/dodaj/gric",
      description: t("home.addSheet.gricDesc"),
    },
    {
      key: "deklaracija",
      label: t("home.addSheet.label"),
      icon: Camera,
      href: "/dodaj/deklaracija",
    },
    // "Trening" is the one row here that is not about food. It sits at the
    // bottom on purpose: this menu's job is logging what went IN, and putting
    // movement above a meal method would suggest the two cancel out. They do
    // not -- a logged workout never becomes extra allowance (the plan already
    // pays for training via the TDEE multiplier; see
    // `src/lib/workout/activities.ts`), which is why it earns a row rather
    // than a badge.
    {
      key: "trening",
      label: t("trening.card.label"),
      icon: Dumbbell,
      href: "/dodaj/trening",
      description: t("trening.addSheet.desc"),
    },
    // Barcode scanning was dropped from this menu on purpose: a barcode only
    // yields the per-100g label data the user is already photographing, and it
    // sat here as a dead "Uskoro" row. The scanner code and its route
    // (`/dodaj/skener`, still used by the admin food editor) stay in place.
  ];
}

export function AddSheet() {
  const { t } = useT();
  const OPTIONS = buildOptions(t);
  const [isOpen, setIsOpen] = useState(false);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      {/* Inline "+" trigger -- positioned by the floating nav bar
          (`AppNavBar`) beside the tab pill, not self-positioned. */}
      <button
        type="button"
        onClick={open}
        data-testid="add-sheet-open-button"
        aria-label={t("home.addSheet.title")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="liquid-glass pointer-events-auto flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
      >
        <Plus className="size-7" aria-hidden="true" />
      </button>

      {/* The sheet renders through a portal to <body>, escaping the floating
          nav bar's `pointer-events-none` / z-40 stacking context. Without this
          the backdrop and options can't receive taps (clicks fall through to
          the nav tabs behind), and the sheet can't be dismissed. */}
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
              data-testid="add-sheet-overlay"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-sheet-title"
                data-testid="add-sheet"
                className="flex w-full max-w-sm flex-col gap-5 rounded-t-xl border border-border bg-background px-6 py-8 shadow-lg sm:rounded-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="add-sheet-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    {t("home.addSheet.title")}
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    data-testid="add-sheet-close-button"
                    aria-label={t("home.close")}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {OPTIONS.map(
                    ({
                      key,
                      label,
                      icon: Icon,
                      href,
                      description,
                      badge,
                      badgeTone,
                    }) => {
                      const isAccent = Boolean(badge) && badgeTone === "accent";
                      const isSoft = Boolean(badge) && !isAccent;

                      return (
                        <Link
                          key={key}
                          href={href}
                          onClick={close}
                          data-testid={`add-sheet-option-${key}`}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors",
                            "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            // Deliberately a wide gap, not neighbouring shades:
                            // if the two tints were close the eye would read
                            // them as the same weight and the hierarchy would
                            // be lost.
                            isAccent && "border-primary/60 bg-primary/15",
                            isSoft && "border-primary/20 bg-primary/[0.04]",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-5 shrink-0",
                              isAccent && "text-primary",
                              isSoft && "text-primary/50",
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex flex-1 flex-col">
                            <span>{label}</span>
                            {description ? (
                              <span
                                data-testid={`add-sheet-desc-${key}`}
                                className="text-xs font-normal text-muted-foreground"
                              >
                                {description}
                              </span>
                            ) : null}
                          </span>
                          {badge ? (
                            <span
                              data-testid={`add-sheet-badge-${key}`}
                              data-tone={isAccent ? "accent" : "soft"}
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                                isAccent
                                  ? "border-primary/50 bg-primary/20 text-primary"
                                  : "border-primary/25 bg-primary/[0.06] text-muted-foreground",
                              )}
                            >
                              {badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    },
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
