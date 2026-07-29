"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, Loader2, Share2 } from "lucide-react";

import { downscaleImage } from "@/lib/image/downscale";
import type { CardFormat } from "@/lib/share/card";
import { canShareFiles, saveFileViaLink, shareFiles } from "@/lib/share/web-share";
import { cn } from "@/lib/utils";

/**
 * "Podeli karticu" — the share trigger on the Prizma result screen (Share-cards
 * PRD §5, "Posle skena"). One tap builds the branded card server-side
 * (`/api/card/scan`) and hands it to the native share sheet; a preview of the
 * exact image is shown so the moment feels finished, never a black box.
 *
 * PRD anti-rule (§5): "nikad nasilno" — no popup, no nagging. This is a calm,
 * always-visible control the user chooses to press. It is deliberately the
 * SECONDARY action on the screen (logging the meal stays primary).
 *
 * The iOS gesture dance is the same one the data-export button solved: building
 * the file spends the tap, so on failure we keep the built file and let the
 * next tap share it instantly (see `lib/share/web-share.ts`).
 */

type Phase = "idle" | "preparing" | "ready" | "done";

interface BuiltCard {
  format: CardFormat;
  file: File;
}

export interface ShareCardButtonProps {
  /** The original meal photo (downscaled here for the card background). */
  photo: File;
  dishName: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const FORMAT_OPTIONS: { value: CardFormat; label: string; hint: string }[] = [
  { value: "story", label: "Story", hint: "9:16" },
  { value: "post", label: "Objava", hint: "1:1" },
];

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

export function ShareCardButton({
  photo,
  dishName,
  kcal,
  protein,
  carbs,
  fat,
}: ShareCardButtonProps) {
  const [format, setFormat] = useState<CardFormat>("story");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Can this platform hand a file to a native share sheet at all? Drives the
  // button's copy: "Podeli" (mobile) vs "Sačuvaj" (desktop) up front.
  const shareCapable = useShareCapable();

  // The last successfully built card, reused across taps within one format.
  const builtRef = useRef<BuiltCard | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Revoke the preview object URL on unmount (and whenever a new one replaces it).
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function setPreview(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function chooseFormat(next: CardFormat) {
    if (next === format) return;
    // A different aspect is a different image: drop the cached build + preview.
    builtRef.current = null;
    setPreview(null);
    setPhase("idle");
    setError(null);
    setFormat(next);
  }

  async function buildCard(): Promise<File> {
    const background = await downscaleImage(photo, 1080, 0.85);
    const body = new FormData();
    body.append("slika", background, "obrok.jpg");
    body.append("naziv", dishName);
    body.append("kcal", String(kcal));
    body.append("protein", String(protein));
    body.append("carbs", String(carbs));
    body.append("fat", String(fat));
    body.append("format", format);

    const response = await fetch("/api/card/scan", {
      method: "POST",
      body,
      credentials: "same-origin",
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("image/png")) {
      throw new Error("card build failed");
    }
    const blob = await response.blob();
    return new File([blob], `fitmess-${format}.png`, { type: "image/png" });
  }

  async function deliver(file: File) {
    if (canShareFiles([file])) {
      const outcome = await shareFiles([file], { title: "FitMess" });
      if (outcome === "shared") {
        setPhase("done");
        return;
      }
      // Cancelled, or the gesture expired mid-build: one more tap shares it.
      setPhase("ready");
      return;
    }
    saveFileViaLink(file);
    setPhase("done");
  }

  async function handleShare() {
    if (phase === "preparing") return;
    setError(null);

    const cached = builtRef.current;
    if (cached && cached.format === format) {
      await deliver(cached.file);
      return;
    }

    setPhase("preparing");
    try {
      const file = await buildCard();
      builtRef.current = { format, file };
      setPreview(file);
      await deliver(file);
    } catch {
      setError("Nismo uspeli da napravimo karticu. Pokušaj ponovo.");
      setPhase("idle");
    }
  }

  const busy = phase === "preparing";
  const shared = phase === "done";
  // No share sheet on this platform -> the card is saved, not shared.
  const downloadOnly = !shareCapable;
  const label = busy
    ? "Pravim karticu…"
    : phase === "ready"
      ? "Podeli još jednom"
      : shared
        ? downloadOnly
          ? "Sačuvaj ponovo"
          : "Podeli ponovo"
        : downloadOnly
          ? "Sačuvaj karticu"
          : "Podeli karticu";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Podeli ovaj obrok
        </span>
        <div
          role="group"
          aria-label="Format kartice"
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
                {option.label}
                <span
                  className={cn(
                    "text-[10px]",
                    on ? "text-primary-foreground/70" : "text-muted-foreground/70"
                  )}
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {previewUrl ? (
        <div className="flex justify-center rounded-2xl border border-border bg-muted/40 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Pregled kartice za deljenje"
            className={cn(
              "rounded-xl object-contain shadow-lg",
              format === "story" ? "max-h-80" : "max-h-72"
            )}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        data-testid="share-card-button"
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 text-base font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : shared ? (
          <Check className="size-5" aria-hidden="true" />
        ) : downloadOnly ? (
          <Download className="size-5" aria-hidden="true" />
        ) : (
          <Share2 className="size-5" aria-hidden="true" />
        )}
        {label}
      </button>

      <p
        aria-live="polite"
        className={cn(
          "text-center text-xs leading-relaxed",
          error ? "text-destructive" : "text-muted-foreground"
        )}
        data-testid="share-card-status"
      >
        {error ??
          (phase === "ready"
            ? "Kartica je spremna — dodirni još jednom da izabereš gde ideš."
            : phase === "done"
              ? downloadOnly
                ? "Sačuvano. 🔥"
                : "Podeljeno. 🔥"
              : "Napravimo ti karticu za story — tvoja fotka, tvoji brojevi.")}
      </p>
    </div>
  );
}
