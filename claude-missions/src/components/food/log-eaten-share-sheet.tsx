"use client";

import { UtensilsCrossed, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EatenShare } from "@/components/food/eaten-share";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { foodEmoji } from "@/lib/food/emoji";
import {
  FULL_EATEN_SHARE,
  applyEatenShare,
  storedEatenShare,
} from "@/lib/log/eaten-share";
import type { Log } from "@/lib/types/db";

// "Nisam sve pojeo" — the third button on a meal card, between "Dodaj još" and
// "Obriši".
//
// That row is one family of thoughts: there was MORE of it, there was LESS of
// it, it never happened. This is the middle one, and it belongs here rather
// than on the capture screen for a reason the first version got wrong -- when
// you photograph a plate you have not eaten any of it yet. The honest moment
// for "I left a third" is afterwards, looking at the entry.
//
// One control, defaulting to 100%, so the person who cleaned their plate never
// has to think about it. Everything downstream (the day's ring, the week, the
// micronutrient page) keeps reading `logs.kcal` and needs no idea this exists:
// a half-eaten meal simply IS a smaller meal.
//
// Fully reversible, which is why 0025 stores the share rather than just scaling
// the row: set 30% by mistake, reopen, slide back to 100%, and the entry is
// exactly what it was. Without the stored ratio the only way back would be to
// ask for 333% of what's left.

interface LogResponseBody {
  ok: boolean;
  error_sr?: string;
  data?: Log;
}

export function LogEatenShareSheet({
  log,
  hasPhoto = false,
  onSaved,
}: {
  log: Log;
  /** True when the entry has a stored photo, so the question can name what the
   * "whole" was: "od celog slikanog obroka". */
  hasPhoto?: boolean;
  /** Called with the rescaled row, so the day's ring/macros recompute. */
  onSaved?: (updatedLog: Log) => void;
}) {
  const { t } = useT();
  const [entry, setEntry] = useState<Log>(log);
  const storedShare = storedEatenShare(entry);

  const [isOpen, setIsOpen] = useState(false);
  const [share, setShare] = useState(storedShare);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // The same function the server re-runs against the stored row, so what the
  // slider shows and what gets written cannot disagree (the guarantee "Dodaj
  // još" and the portion picker already give). The resulting figure lives in
  // the slider's own readout -- a second "obrok postaje N kcal" card underneath
  // was the same sentence a third time.
  const preview = useMemo(
    () => applyEatenShare(entry, share),
    [entry, share]
  );
  /** The whole plate at the current per-kcal rate — what "ostalo je" measures
   * against. */
  const servedKcal = (entry.kcal / Math.max(storedShare, 1)) * FULL_EATEN_SHARE;

  function openSheet() {
    // Always reopens on the entry's ACTUAL share, never on 100 -- that is what
    // makes a mistaken 30% one drag away from undone.
    setShare(storedShare);
    setErrorMessage(undefined);
    setIsOpen(true);
  }

  function closeSheet() {
    // Mid-write is the one moment closing would be a lie.
    if (isSaving) return;
    setIsOpen(false);
  }

  // Escape closes it, like every other sheet in the app.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function onConfirm() {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(undefined);
    try {
      const response = await fetch(`/api/logs/${entry.id}/pojedeno`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ share }),
      });
      const body = (await response.json()) as LogResponseBody;

      if (!response.ok || !body.ok || !body.data) {
        setIsSaving(false);
        setErrorMessage(body.error_sr || t("food.eaten.saveError"));
        return;
      }

      setEntry(body.data);
      setIsSaving(false);
      onSaved?.(body.data);
      setIsOpen(false);
    } catch {
      setIsSaving(false);
      setErrorMessage(t("food.eaten.saveError"));
    }
  }

  return (
    <div>
      {/* The button says which state the entry is IN, not just what tapping it
          does: an entry already marked 60% wears that number, so the card is
          readable without opening anything. */}
      <Button
        type="button"
        variant="outline"
        onClick={openSheet}
        data-testid={`log-eaten-open-${log.id}`}
      >
        <UtensilsCrossed className="size-4" aria-hidden="true" />
        {storedShare >= FULL_EATEN_SHARE
          ? t("food.eaten.open")
          : t("food.eaten.openWithShare", { share: Math.round(storedShare) })}
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 backdrop-blur-[2px] sm:items-center sm:px-6"
          data-testid="log-eaten-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-eaten-title"
            data-testid="log-eaten-sheet"
            className="flex max-h-[88vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-t-3xl border border-border bg-background px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-3xl sm:pb-7"
          >
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
                  id="log-eaten-title"
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
              <button
                type="button"
                onClick={closeSheet}
                disabled={isSaving}
                aria-label={t("food.addMore.close")}
                data-testid="log-eaten-close"
                className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-foreground/10 disabled:opacity-30"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <EatenShare
              share={share}
              onShareChange={(next) => {
                setShare(next);
                setErrorMessage(undefined);
              }}
              eatenGrams={preview.grams}
              eatenKcal={preview.kcal}
              servedKcal={servedKcal}
              fromPhoto={hasPhoto}
              disabled={isSaving}
            />

            {errorMessage ? (
              <p
                role="alert"
                data-testid="log-eaten-error"
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
                disabled={isSaving}
                data-testid="log-eaten-cancel"
                className="flex-1"
              >
                {t("food.cancel")}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={isSaving}
                data-testid="log-eaten-save"
                className="flex-[1.6]"
              >
                {isSaving ? t("food.addMore.saving") : t("food.eaten.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
