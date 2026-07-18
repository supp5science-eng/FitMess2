"use client";

import { useEffect } from "react";

/**
 * Registers the FitMess service worker (`/public/sw.js`) once, on the client,
 * after the page has loaded. Renders nothing.
 *
 * The service worker is what turns the landing page's "Instaliraj" button
 * into a real install (browsers require a registered SW with a fetch handler
 * before they offer installation) and provides the offline fallback. It is
 * registered app-wide (mounted in the root layout) so the installed PWA is
 * controlled on every route, not just the landing page.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[FitMess] service worker registration failed:", error);
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
