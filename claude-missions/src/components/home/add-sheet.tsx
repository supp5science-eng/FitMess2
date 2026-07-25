"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Camera, Cookie, Mic, Plus, Target, UtensilsCrossed, X } from "lucide-react";

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
  /** Optional teal highlight badge (e.g. "NAJTAČNIJE") -- also tints the row to
   * gently pull the eye toward the recommended method. */
  badge?: string;
}

// "Pretraži" (catalog search) and "Dodaj proizvod" (manual product create) were
// intentionally removed from this menu -- the app is photo/voice-first, so those
// two entry points are no longer offered here. Their routes still EXIST as
// hidden fallbacks (the barcode scanner's "manual search" escape hatch, the
// portion flow, etc.), so nothing breaks; they're just no longer advertised.
const OPTIONS: AddSheetOption[] = [
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
    description: "92% tačnost procene kalorija",
    badge: "NAJTAČNIJE",
  },
  {
    key: "obrok",
    label: "Slikaj obrok",
    icon: UtensilsCrossed,
    href: "/dodaj/obrok",
  },
  {
    key: "glas",
    label: "Reci obrok",
    icon: Mic,
    href: "/dodaj/glas",
    description: "Izgovori vrednosti ili samo opiši obrok",
  },
  // "Gric" sits below the two spoken/photographed MEAL methods because it
  // answers a different question: not "how do I log this meal accurately" but
  // "how do I log this at all". A cucumber costs more to photograph than it is
  // worth, so it goes unlogged and the day's total quietly reads too low.
  {
    key: "gric",
    label: "Gric",
    icon: Cookie,
    href: "/dodaj/gric",
    description: "Sitnice — reci ih sve odjednom, bez slikanja",
  },
  {
    key: "deklaracija",
    label: "Slikaj deklaraciju",
    icon: Camera,
    href: "/dodaj/deklaracija",
  },
  // Barcode scanning was dropped from this menu on purpose: a barcode only
  // yields the per-100g label data the user is already photographing, and it
  // sat here as a dead "Uskoro" row. The scanner code and its route
  // (`/dodaj/skener`, still used by the admin food editor) stay in place.
];

export function AddSheet() {
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
        aria-label="Dodaj unos"
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
                    Dodaj unos
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    data-testid="add-sheet-close-button"
                    aria-label="Zatvori"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {OPTIONS.map(
                    ({ key, label, icon: Icon, href, description, badge }) => (
                      <Link
                        key={key}
                        href={href}
                        onClick={close}
                        data-testid={`add-sheet-option-${key}`}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors",
                          "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          badge && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 shrink-0",
                            badge && "text-primary",
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
                            className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary"
                          >
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    ),
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
