"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

/**
 * A strip that appears while the device has no connection.
 *
 * `public/offline.html` covers the case where a whole PAGE cannot be reached.
 * This covers the other half, which is the one the user actually meets: the app
 * is already open, the connection drops, and every tap that writes something —
 * logging a meal, a glass of water, a weigh-in — goes to a server action that
 * now silently fails. FitMess keeps everything server-side (there is no offline
 * store, see `docs/izlazak-u-store.md`), so without this the app looks like it
 * is ignoring the user rather than like it cannot reach the network.
 *
 * It states the fact and offers nothing else. There is no retry button, because
 * there is nothing here to retry: the connection comes back on its own and the
 * strip disappears when it does.
 *
 * `navigator.onLine` only knows whether the device has a network interface, so
 * it can read "online" on a Wi-Fi with no internet behind it. That direction is
 * harmless: it means we stay quiet and the user sees the individual failure.
 * The reverse — offline reported as online — does not happen, and that is the
 * direction this depends on.
 */
export function OfflineNotice() {
  // Starts false on both server and client: `navigator.onLine` cannot be read
  // during server rendering, and seeding it during the first client render
  // would produce a hydration mismatch. The effect below settles it
  // immediately, so an already-offline launch still gets the strip.
  const [offline, setOffline] = useState(false);
  const { t } = useT();

  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      // Announced when it appears, but never stealing focus mid-task.
      role="status"
      aria-live="polite"
      data-testid="offline-notice"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <p className="flex items-center gap-2 rounded-full bg-foreground/90 px-4 py-2 text-xs font-medium text-background shadow-lg">
        <WifiOff className="size-3.5 shrink-0" aria-hidden={true} />
        {t("app.offline.banner")}
      </p>
    </div>
  );
}
