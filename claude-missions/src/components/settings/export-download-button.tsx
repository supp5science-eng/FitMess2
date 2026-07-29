"use client";

import { useRef, useState } from "react";
import { Download, FileDown, Loader2 } from "lucide-react";

import { exportErrorText } from "@/lib/export/error-messages";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * The "Preuzmi PDF" / "Preuzmi .json" control on `/profil/moji-podaci`.
 *
 * It used to be a plain `<a href="/api/export/pdf" download>`. That is the
 * correct thing on a desktop browser and it is a TRAP inside an installed PWA
 * on iOS: iOS ignores both `Content-Disposition: attachment` and the `download`
 * attribute for a PDF, renders it in the same standalone webview, and gives
 * that view no back button or tab bar -- the only way out is force-quitting the
 * app. Exactly what the user hit.
 *
 * So the file is never navigated to. We `fetch` it, and then hand the bytes to
 * the platform:
 *
 * 1. `navigator.share({ files })` when available -- on iOS this is the native
 *    share sheet ("Sačuvaj u Fajlove", Mail, WhatsApp…) and it closes back onto
 *    the app. This is the real fix.
 * 2. otherwise a `blob:` link click -- Android/desktop save it straight away.
 *
 * iOS only allows `share()` while a user gesture is still "live", and awaiting
 * the fetch can spend it (`NotAllowedError`). We keep the built file in a ref
 * and, if that happens, flip the button to "Sačuvaj …" -- the next tap is a
 * fresh gesture and shares the already-built file instantly, with no second
 * round trip to the server.
 */

type Phase = "idle" | "preparing" | "ready" | "done";

const FETCH_ERROR_REASON = "mreza";

export function ExportDownloadButton({
  href,
  contentType,
  fallbackFilename,
  label,
  readyLabel,
  doneText,
  variant = "primary",
  testId,
}: {
  /** Route that returns the file. */
  href: string;
  /** What a successful response must be; anything else means we were bounced
   * to an HTML page instead of getting a file. */
  contentType: string;
  fallbackFilename: string;
  label: string;
  /** Label for the "tap once more to open the share sheet" state. */
  readyLabel: string;
  doneText: string;
  variant?: "primary" | "quiet";
  testId?: string;
}) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  async function deliver(file: File) {
    if (canShareFile(file)) {
      const outcome = await shareFile(file);
      if (outcome === "shared") {
        setPhase("done");
        return;
      }
      // Cancelled by the user, or the gesture expired mid-fetch. Either way the
      // file is already in hand -- one more tap opens the sheet.
      setPhase("ready");
      return;
    }

    saveViaLink(file);
    setPhase("done");
  }

  async function handleClick() {
    if (phase === "preparing") return;
    setError(null);

    const ready = fileRef.current;
    if (ready) {
      // Inside a fresh gesture: share() is allowed here.
      await deliver(ready);
      return;
    }

    setPhase("preparing");
    try {
      const file = await fetchExportFile({ href, contentType, fallbackFilename });
      fileRef.current = file;
      await deliver(file);
    } catch (err) {
      setError(
        exportErrorText(
          err instanceof ExportDownloadError ? err.reason : FETCH_ERROR_REASON
        )
      );
      setPhase("idle");
    }
  }

  const busy = phase === "preparing";
  const text = busy ? t("app.export.preparing") : phase === "ready" ? readyLabel : label;
  const Icon = variant === "primary" ? FileDown : Download;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        data-testid={testId}
        data-endpoint={href}
        className={cn(
          variant === "primary"
            ? "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            : "mt-1 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-70"
        )}
      >
        {busy ? (
          <Loader2
            className={variant === "primary" ? "size-4 animate-spin" : "size-3.5 animate-spin"}
            aria-hidden={true}
          />
        ) : (
          <Icon
            className={variant === "primary" ? "size-4" : "size-3.5"}
            aria-hidden={true}
          />
        )}
        {text}
      </button>

      <p
        aria-live="polite"
        className={cn(
          "text-xs leading-relaxed",
          error ? "text-destructive" : "text-muted-foreground"
        )}
        data-testid={testId ? `${testId}-status` : undefined}
      >
        {error ??
          (phase === "ready"
            ? t("app.export.ready")
            : phase === "done"
              ? doneText
              : "")}
      </p>
    </div>
  );
}

/** Carries the `?greska=` reason the export routes redirect back with. */
class ExportDownloadError extends Error {
  constructor(readonly reason: string) {
    super(`export download failed: ${reason}`);
    this.name = "ExportDownloadError";
  }
}

async function fetchExportFile({
  href,
  contentType,
  fallbackFilename,
}: {
  href: string;
  contentType: string;
  fallbackFilename: string;
}): Promise<File> {
  const response = await fetch(href, {
    credentials: "same-origin",
    cache: "no-store",
  });

  // The routes answer a failure with a redirect back to the page carrying
  // `?greska=` (they were built for link navigation). Through `fetch` that
  // arrives as an HTML page -- so an unexpected content type IS the error, and
  // the final URL still tells us why.
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes(contentType)) {
    throw new ExportDownloadError(reasonFromUrl(response.url) ?? "1");
  }

  const blob = await response.blob();
  return new File([blob], filenameFrom(response, fallbackFilename), {
    type: contentType,
  });
}

function reasonFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    // Middleware may bounce an expired session to the login page instead.
    if (parsed.pathname.startsWith("/prijava")) return "sesija";
    return parsed.searchParams.get("greska");
  } catch {
    return null;
  }
}

function filenameFrom(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function shareFile(file: File): Promise<"shared" | "retry"> {
  try {
    await navigator.share({ files: [file], title: file.name });
    return "shared";
  } catch {
    // AbortError (user closed the sheet) and NotAllowedError (the gesture was
    // spent by the fetch) both mean the same thing for us: try again on the
    // next tap, without rebuilding the file.
    return "retry";
  }
}

function saveViaLink(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Generous, because the browser may still be reading the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
