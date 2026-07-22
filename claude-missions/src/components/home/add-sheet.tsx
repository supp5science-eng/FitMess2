"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Barcode,
  Camera,
  Mic,
  Plus,
  Target,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
// Barcode scanning (F030/M4) is now real -- routes to `/dodaj/skener`. Both
// photo flows (F062/F064/M7) are not built yet -- per the clarified scope,
// those two options are still shown (not hidden) but ROUTE to a clear
// Serbian "uskoro" (coming soon) placeholder page
// (`/dodaj/uskoro/[metoda]`) rather than a broken 404 or a dead click. This
// keeps the "at most 2 taps to START any method" promise literally true for
// all four methods, and F062/F064 later only need to replace each
// remaining `available: false` row's `href` with the real flow -- this
// sheet's own structure does not change.

interface AddSheetOption {
  key: string;
  label: string;
  icon: typeof Camera;
  href: string;
  available: boolean;
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
  // The highest-accuracy path (photo + spoken/typed portion) leads the menu and
  // carries a teal "NAJTAČNIJE" badge to draw people to try it.
  {
    key: "najtacnije",
    label: "Najtačniji unos",
    icon: Target,
    href: "/dodaj/najtacnije",
    available: true,
    description: "Slikaj + reci šta si pojeo",
    badge: "NAJTAČNIJE",
  },
  {
    key: "obrok",
    label: "Slikaj obrok",
    icon: UtensilsCrossed,
    href: "/dodaj/obrok",
    available: true,
  },
  {
    key: "glas",
    label: "Reci obrok",
    icon: Mic,
    href: "/dodaj/glas",
    available: true,
    description: "Izgovori vrednosti ili samo opiši obrok",
  },
  {
    key: "deklaracija",
    label: "Slikaj deklaraciju",
    icon: Camera,
    href: "/dodaj/deklaracija",
    available: true,
  },
  // Barcode scanning is de-prioritised for now (a barcode only yields
  // per-100g label data the user is already photographing) -- kept last and
  // routed to the "uskoro" placeholder instead of the live `/dodaj/skener`
  // scanner. The scanner code stays in place; flip this row back when it
  // returns.
  {
    key: "barkod",
    label: "Skeniraj barkod",
    icon: Barcode,
    href: "/dodaj/uskoro/barkod",
    available: false,
  },
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
                    ({
                      key,
                      label,
                      icon: Icon,
                      href,
                      available,
                      description,
                      badge,
                    }) => (
                      <Link
                        key={key}
                        href={href}
                        onClick={close}
                        data-testid={`add-sheet-option-${key}`}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors",
                          "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          !available && "text-muted-foreground",
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
                        ) : !available ? (
                          <Badge
                            variant="secondary"
                            data-testid={`add-sheet-soon-badge-${key}`}
                          >
                            Uskoro
                          </Badge>
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
