"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

// "Osveži aplikaciju": a PWA cache-buster. Installed PWAs aggressively serve
// the cached app shell, so after a deploy users can keep seeing an old build
// until the service worker updates -- a recurring confusion. This clears the
// Cache Storage, nudges the service worker to update, then hard-reloads so the
// freshest build loads. Styled as a settings row (matches SettingsLinkRow) but
// needs client JS, so it's its own button.
export function RefreshAppButton() {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  async function handleRefresh() {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(
          keys
            // Only the APP SHELL buckets (`sw.js`'s `OWNED_CACHE_PREFIX`).
            // This button's job is "stop serving me an old build" -- the
            // rendered share cards in `fitmess-share-cards-*` are not a build,
            // they are minutes of server render the user already paid for, and
            // wiping them made "Podeli" slow again for no gain here.
            .filter((key) => key.startsWith("fitmess-shell-"))
            .map((key) => caches.delete(key))
        );
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.update()));
      }
    } catch {
      // Best-effort: even if cache clearing fails, still reload below.
    } finally {
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={busy}
      className="block w-full text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-60"
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <RefreshCw
            className={`size-[18px] ${busy ? "animate-spin" : ""}`}
            aria-hidden={true}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {busy ? t("app.refresh.busy") : t("app.refresh.label")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t("app.refresh.desc")}
          </span>
        </div>
      </div>
    </button>
  );
}
