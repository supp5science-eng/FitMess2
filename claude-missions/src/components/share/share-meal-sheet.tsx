"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Download, Loader2, Share2, X } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { sheetPortal } from "@/components/ui/sheet-portal";
import type { CardFormat } from "@/lib/share/card";
import { getCard, peekCard, prewarmCard } from "@/lib/share/card-cache";
import {
  canShareFiles,
  saveFileViaLink,
  shareFiles,
} from "@/lib/share/web-share";
import { cn } from "@/lib/utils";

/**
 * "Podeli" — the share trigger that sits beside a logged meal on `/danas`
 * (Share-cards PRD §3.1/§5). It opens a small bottom sheet that renders the
 * meal's "Scan moment" card server-side, previews it, and hands it to the
 * native share sheet.
 *
 * Only meals WITH a stored photo get this button (a scan card is photo-first),
 * so the caller gates it on `hasPhoto`. The card is built from the `logId`
 * alone — name, macros, tier and the photo are all read server-side
 * (`/api/card/scan`), so nothing shareable is ever client-authored.
 *
 * The trigger is a frosted-glass chip the meal card floats over its photo (see
 * the note at the trigger itself), and the sheet shares ONE format: 9:16.
 *
 * Building a card is slow and entirely server-side (~6 s cold, ~1.2 s warm, for
 * a ~2.5 MB PNG), so this component never builds one it could reuse: caching,
 * request de-duplication and background prewarming all live in
 * `lib/share/card-cache.ts`. Two consequences worth knowing here:
 *
 *  - The default ("story") card is PREWARMED at idle as soon as a shareable meal
 *    is on screen — which, since logging a photo meal lands on `/danas`, means
 *    the card is usually finished before the user ever taps "Podeli".
 *  - The cache is persistent (Cache Storage), so a card survives a reload and
 *    navigation away and back. A card the user already created never renders
 *    twice.
 *
 * Because the file is ready, share() still fires inside a fresh, live gesture —
 * the iOS `NotAllowedError` case the export button had to recover from mostly
 * can't arise here. The retry path is kept anyway.
 */

type Phase = "idle" | "building" | "ready" | "shared" | "error";

/**
 * The only format the app shares: 9:16, the story aspect this card was designed
 * for. The server still renders 1:1 (`CARD_FORMATS.post`) — there is just no UI
 * that asks for it, since a format switch made the sheet busier without adding
 * anything users wanted.
 */
const FORMAT: CardFormat = "story";

export function ShareMealSheet({
  logId,
  mealName,
  className,
}: {
  logId: string;
  /** Only for the native share-sheet title; the card text is read server-side. */
  mealName: string;
  /** Positioning for the trigger chip — it floats over the meal photo, so the
   * meal card owns where exactly. */
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function showPreview(file: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  /** Render one card on the server. The cache layer decides IF this ever runs. */
  const buildCard = useCallback(
    async (id: string, target: CardFormat): Promise<File> => {
      const response = await fetch("/api/card/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: id, format: target }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("image/png")) {
        throw new Error("card build failed");
      }
      const blob = await response.blob();
      return new File([blob], `fitmess-${target}.png`, { type: "image/png" });
    },
    []
  );

  /** Ensure the card for `target` is previewed, building it only if no cache
   * layer has it. A memory hit skips the "building" phase entirely, so a
   * prewarmed card opens with no spinner frame at all. */
  async function ensureBuilt(target: CardFormat) {
    const warm = peekCard(logId, target);
    if (warm) {
      showPreview(warm);
      setPhase("ready");
      return;
    }
    setPhase("building");
    try {
      const file = await getCard(logId, target, buildCard);
      showPreview(file);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  // Prewarm the default card the moment a shareable meal is on screen, so the
  // first "Podeli" tap opens onto a finished card instead of a spinner. Runs at
  // idle so it never competes with hydration, and goes through the shared serial
  // queue so several photo meals on `/danas` can't fire concurrent 2.5 MB
  // renders. Already-cached cards (incl. from a previous visit) cost nothing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) void prewarmCard(logId, "story", buildCard);
    };
    const handle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(run, { timeout: 2000 })
        : window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(handle as number);
      window.clearTimeout(handle as number);
    };
  }, [logId, buildCard]);

  function openSheet() {
    setOpen(true);
    void ensureBuilt(FORMAT);
  }

  function closeSheet() {
    setOpen(false);
    // Keep the built cards; just reset the transient "done" state so a reopen
    // starts clean. Preview URLs live until unmount.
    if (phase === "shared") setPhase("ready");
  }

  async function handleShare() {
    const file = peekCard(logId, FORMAT);
    if (!file) return;
    if (canShareFiles([file])) {
      const outcome = await shareFiles([file], { title: mealName });
      setPhase(outcome === "shared" ? "shared" : "ready");
      return;
    }
    saveFileViaLink(file);
    setPhase("shared");
  }

  const building = phase === "building";
  const shared = phase === "shared";
  const downloadOnly = useShareCapable() === false;
  const canAct = phase === "ready" || shared;
  const actionLabel = downloadOnly
    ? shared
      ? t("food.share.saveAgain")
      : t("food.share.save")
    : shared
      ? t("food.share.shareAgain")
      : t("food.share.share");

  return (
    <>
      {/* The trigger is a frosted-glass chip that floats ON the meal photo,
          mirroring the kcal pill on the opposite corner — the same vocabulary
          the media header already speaks. It deliberately does NOT sit in the
          footer row with "Dodaj još"/"Izmeni"/"Obriši": those are corrections to
          an entry, while this is the one outward-facing, celebratory action, and
          as an identical outline button it read as neither.

          It is a SIBLING of the photo button, not a child — the photo itself is
          a <button> (it opens the lightbox) and nesting buttons is invalid. */}
      <button
        type="button"
        onClick={openSheet}
        data-testid={`share-meal-open-${logId}`}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-sm",
          "font-semibold text-white shadow-sm ring-1 ring-white/20 backdrop-blur-md",
          "transition-all duration-200 hover:bg-black/55 active:scale-95",
          className
        )}
      >
        <Share2 className="size-3.5" aria-hidden="true" />
        {t("food.share.share")}
      </button>

      {open
        ? sheetPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
              onClick={closeSheet}
              data-testid="share-meal-overlay"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("food.share.dialogAria")}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-t-3xl border-t border-border bg-background p-5 pb-8 shadow-2xl"
              >
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />

                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    {t("food.share.heading")}
                  </h2>
                  <button
                    type="button"
                    onClick={closeSheet}
                    aria-label={t("food.share.close")}
                    className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Sized for the 9:16 card — the only aspect the app shares. */}
                <div className="flex h-[380px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
                  {phase === "error" ? (
                    <p className="px-6 text-center text-sm text-destructive">
                      {t("food.share.buildError")}
                    </p>
                  ) : previewUrl && !building ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={t("food.share.previewAlt")}
                      className="max-h-full rounded-xl object-contain shadow-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                      <span className="text-xs">
                        {t("food.share.building")}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={handleShare}
                  disabled={!canAct}
                  data-testid="share-meal-action"
                  className="mt-4 w-full"
                >
                  {building ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : shared ? (
                    <Check aria-hidden="true" />
                  ) : downloadOnly ? (
                    <Download aria-hidden="true" />
                  ) : (
                    <Share2 aria-hidden="true" />
                  )}
                  {actionLabel}
                </Button>

                <p
                  aria-live="polite"
                  data-testid="share-meal-status"
                  className="mt-3 text-center text-xs text-muted-foreground"
                >
                  {shared
                    ? downloadOnly
                      ? t("food.share.savedStatus")
                      : t("food.share.sharedStatus")
                    : t("food.share.idleStatus")}
                </p>
              </div>
            </div>
          )
        : null}
    </>
  );
}

/** A capability, not React state, and client-only (needs `navigator`): read it
 * SSR-safely with `useSyncExternalStore` so it never triggers a hydration
 * mismatch and never needs a setState-in-effect (which this codebase avoids). */
const emptySubscribe = () => () => {};
function useShareCapable(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () =>
      canShareFiles([
        new File([new Uint8Array([137, 80, 78, 71])], "probe.png", {
          type: "image/png",
        }),
      ]),
    () => false
  );
}
