"use client";

import { useState } from "react";
import Link from "next/link";
import { Barcode, Camera, Plus, Search, UtensilsCrossed, X } from "lucide-react";

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
  icon: typeof Search;
  href: string;
  available: boolean;
}

const OPTIONS: AddSheetOption[] = [
  {
    key: "pretrazi",
    label: "Pretraži",
    icon: Search,
    href: "/dodaj/pretraga",
    available: true,
  },
  {
    key: "barkod",
    label: "Skeniraj barkod",
    icon: Barcode,
    href: "/dodaj/skener",
    available: true,
  },
  {
    key: "deklaracija",
    label: "Slikaj deklaraciju",
    icon: Camera,
    href: "/dodaj/uskoro/deklaracija",
    available: false,
  },
  {
    key: "obrok",
    label: "Slikaj obrok",
    icon: UtensilsCrossed,
    href: "/dodaj/uskoro/obrok",
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
      <div
        aria-hidden={isOpen}
        className="pointer-events-none fixed inset-x-0 bottom-24 z-40"
      >
        <div className="pointer-events-none mx-auto flex w-full max-w-[430px] justify-end px-6">
          <button
            type="button"
            onClick={open}
            data-testid="add-sheet-open-button"
            aria-label="Dodaj unos"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <Plus className="size-7" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isOpen ? (
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
              {OPTIONS.map(({ key, label, icon: Icon, href, available }) => (
                <Link
                  key={key}
                  href={href}
                  onClick={close}
                  data-testid={`add-sheet-option-${key}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    !available && "text-muted-foreground"
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {!available ? (
                    <Badge
                      variant="secondary"
                      data-testid={`add-sheet-soon-badge-${key}`}
                    >
                      Uskoro
                    </Badge>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
