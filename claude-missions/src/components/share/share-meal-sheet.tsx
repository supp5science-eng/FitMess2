"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, Loader2, Share2, X } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { sheetPortal } from "@/components/ui/sheet-portal";
import type { MessageKey } from "@/lib/i18n/messages";
import type { CardFormat } from "@/lib/share/card";
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
 * Building starts on the trigger tap (and on each format switch), so by the
 * time the user taps "Podeli" the file is ready and share() fires inside a
 * fresh, live gesture — the iOS `NotAllowedError` case the export button had to
 * recover from mostly can't arise here. The retry path is kept anyway.
 */

type Phase = "idle" | "building" | "ready" | "shared" | "error";

const FORMAT_OPTIONS: {
  value: CardFormat;
  labelKey: MessageKey;
  hint: string;
}[] = [
  { value: "story", labelKey: "food.share.formatStory", hint: "9:16" },
  { value: "post", labelKey: "food.share.formatPost", hint: "1:1" },
];

export function ShareMealSheet({
  logId,
  mealName,
}: {
  logId: string;
  /** Only for the native share-sheet title; the card text is read server-side. */
  mealName: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<CardFormat>("story");
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const builtRef = useRef<Map<CardFormat, File>>(new Map());
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

  async function buildCard(target: CardFormat): Promise<File> {
    const response = await fetch("/api/card/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, format: target }),
      credentials: "same-origin",
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("image/png")) {
      throw new Error("card build failed");
    }
    const blob = await response.blob();
    return new File([blob], `fitmess-${target}.png`, { type: "image/png" });
  }

  /** Ensure the card for `target` exists and is previewed. */
  async function ensureBuilt(target: CardFormat) {
    const cached = builtRef.current.get(target);
    if (cached) {
      showPreview(cached);
      setPhase("ready");
      return;
    }
    setPhase("building");
    try {
      const file = await buildCard(target);
      builtRef.current.set(target, file);
      showPreview(file);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  function openSheet() {
    setOpen(true);
    void ensureBuilt(format);
  }

  function closeSheet() {
    setOpen(false);
    // Keep the built cards; just reset the transient "done" state so a reopen
    // starts clean. Preview URLs live until unmount.
    if (phase === "shared") setPhase("ready");
  }

  function chooseFormat(next: CardFormat) {
    if (next === format || phase === "building") return;
    setFormat(next);
    void ensureBuilt(next);
  }

  async function handleShare() {
    const file = builtRef.current.get(format);
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
      <Button
        type="button"
        variant="outline"
        onClick={openSheet}
        data-testid={`share-meal-open-${logId}`}
      >
        <Share2 aria-hidden="true" />
        {t("food.share.share")}
      </Button>

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
                  <div className="flex items-center gap-2">
                    <div
                      role="group"
                      aria-label={t("food.share.formatAria")}
                      className="flex items-center gap-1 rounded-full border border-border bg-background p-1"
                    >
                      {FORMAT_OPTIONS.map((option) => {
                        const on = format === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => chooseFormat(option.value)}
                            aria-pressed={on}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                              on
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {t(option.labelKey)}
                            <span
                              className={cn(
                                "text-[10px]",
                                on
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground/70"
                              )}
                            >
                              {option.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={closeSheet}
                      aria-label={t("food.share.close")}
                      className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40",
                    format === "story" ? "h-[380px]" : "h-[300px]"
                  )}
                >
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
