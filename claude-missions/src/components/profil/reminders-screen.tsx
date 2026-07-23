"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Clock, Share, Smartphone } from "lucide-react";

import { updateReminderTimeAction } from "@/app/(app)/profil/podsetnici/actions";
import { SettingsGroup } from "@/components/settings/settings-group";
import { Button } from "@/components/ui/button";

/**
 * F071 / AS-116, AS-118: the interactive core of `/profil/podsetnici`.
 *
 * One master switch ("Dnevni podsetnik") + a time picker. Turning it ON is
 * the explicit-enable moment AS-116 requires: only that tap triggers the
 * browser's notification-permission prompt, then subscribes this device via
 * the Push API and saves the chosen time server-side. Turning it OFF
 * unsubscribes the device and clears `profiles.reminder_time`, which stops
 * the cron for good (AS-118) even if a stale subscription lingered.
 *
 * Web Push works in an installed PWA everywhere that matters; the one
 * platform quirk is iOS (16.4+): Safari only exposes the Push API to apps
 * added to the home screen. When we detect an iOS browser tab (not
 * standalone), the switch is replaced by a friendly "add to home screen"
 * explainer instead of a dead control.
 */

interface RemindersScreenProps {
  /** `profiles.reminder_time` (`"HH:MM:SS"` / `"HH:MM"`) or null = off. */
  initialTime: string | null;
  /** VAPID public key (safe for the client; pairs with the server's private
   * key). Null = server not configured — screen shows a setup notice. */
  vapidPublicKey: string | null;
}

const DEFAULT_TIME = "19:00";

/** `web-push`'s standard base64url -> Uint8Array conversion for
 * `applicationServerKey`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  // Explicit ArrayBuffer backing so the value satisfies the DOM
  // `BufferSource` type (`ArrayBufferLike` includes SharedArrayBuffer,
  // which `applicationServerKey` rejects at the type level).
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** `"HH:MM:SS"` (Postgres time) -> `"HH:MM"` (what <input type=time> wants). */
function toInputTime(value: string | null): string {
  if (!value) return DEFAULT_TIME;
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : DEFAULT_TIME;
}

type Support = "checking" | "ok" | "ios-tab" | "unsupported";

export function RemindersScreen({
  initialTime,
  vapidPublicKey,
}: RemindersScreenProps) {
  const [enabled, setEnabled] = useState(initialTime !== null);
  const [time, setTime] = useState(toInputTime(initialTime));
  const [support, setSupport] = useState<Support>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Capability probe is inherently client-only (navigator/window), so it
  // runs post-hydration; until then the switch renders disabled.
  useEffect(() => {
    const pushSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (pushSupported) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser capability probe
      setSupport("ok");
      return;
    }
    // iOS Safari in a plain browser tab has no Push API at all — it appears
    // only once the app is installed to the home screen (iOS 16.4+).
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setSupport(isIOS && !standalone ? "ios-tab" : "unsupported");
  }, []);

  async function persistTime(next: string | null): Promise<boolean> {
    const result = await updateReminderTimeAction(next);
    if (!result.ok) {
      setError(result.error_sr);
      return false;
    }
    return true;
  }

  async function enable() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!vapidPublicKey) {
        setError("Podsetnici trenutno nisu dostupni. Pokušaj kasnije.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          "Notifikacije su blokirane. Dozvoli ih za FitMess u podešavanjima telefona, pa pokušaj ponovo."
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("Nešto nije uspelo pri prijavi uređaja. Pokušaj ponovo.");
        return;
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      if (!response.ok) {
        setError("Nismo uspeli da sačuvamo podsetnik. Pokušaj ponovo.");
        return;
      }

      if (await persistTime(time)) {
        setEnabled(true);
        setNotice("Podsetnik je uključen. 🎉");
      }
    } catch (err) {
      console.error("[podsetnici] enable failed:", err);
      setError("Nešto je pošlo naopako. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
      } catch {
        // Device-side cleanup is best-effort; clearing the time below is
        // what actually stops the cron (AS-118).
      }
      if (await persistTime(null)) {
        setEnabled(false);
        setNotice("Podsetnik je isključen.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeTime(next: string) {
    setTime(next);
    setError(null);
    if (enabled) {
      setNotice(null);
      if (await persistTime(next)) {
        setNotice("Vreme podsetnika je sačuvano.");
      }
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const body = (await response.json()) as {
        ok: boolean;
        error_sr?: string;
      };
      if (body.ok) {
        setNotice("Poslato! Notifikacija stiže za koji sekund.");
      } else {
        setError(body.error_sr ?? "Slanje nije uspelo. Pokušaj ponovo.");
      }
    } catch {
      setError("Slanje nije uspelo. Pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  if (support === "ios-tab") {
    return (
      <SettingsGroup title="Podsetnici">
        <div className="flex flex-col gap-3 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Smartphone className="size-[18px]" aria-hidden={true} />
            </span>
            <p className="text-sm font-medium text-foreground">
              Prvo dodaj FitMess na početni ekran
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Na iPhone-u notifikacije rade samo kad je aplikacija instalirana:
            otvori meni <Share className="inline size-4 align-text-bottom" aria-label="Deljenje" />{" "}
            u Safariju i izaberi <b>„Add to Home Screen“</b>. Zatim otvori
            FitMess sa početnog ekrana i vrati se ovde.
          </p>
        </div>
      </SettingsGroup>
    );
  }

  if (support === "unsupported") {
    return (
      <SettingsGroup title="Podsetnici">
        <div className="px-4 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ovaj pregledač ne podržava notifikacije. Probaj da instaliraš
            FitMess kao aplikaciju (dugme „Instaliraj“ na početnoj strani).
          </p>
        </div>
      </SettingsGroup>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup title="Dnevni podsetnik">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            {enabled ? (
              <BellRing className="size-[18px]" aria-hidden={true} />
            ) : (
              <Bell className="size-[18px]" aria-hidden={true} />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">
              Podsetnik za unos
            </span>
            <span className="text-xs text-muted-foreground">
              Jedna poruka dnevno — i ništa ako si već upisao/la obrok.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Dnevni podsetnik"
            disabled={busy || support === "checking"}
            onClick={() => (enabled ? disable() : enable())}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${
              enabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] duration-200 ${
                enabled ? "left-[calc(100%-1.625rem)]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Clock className="size-[18px]" aria-hidden={true} />
          </span>
          <label
            htmlFor="reminder-time"
            className="flex min-w-0 flex-1 flex-col"
          >
            <span className="text-sm font-medium text-foreground">Vreme</span>
            <span className="text-xs text-muted-foreground">
              Po Beogradu, svaki dan
            </span>
          </label>
          <input
            id="reminder-time"
            type="time"
            value={time}
            disabled={busy}
            onChange={(event) => changeTime(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </SettingsGroup>

      {enabled ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={sendTest}
          className="w-full"
        >
          Pošalji probnu notifikaciju
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="px-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="px-1 text-sm text-primary">
          {notice}
        </p>
      ) : null}

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Podsetnik stiže kao notifikacija na ovaj uređaj. Možeš ga isključiti
        ovde kad god poželiš — odmah prestajemo da šaljemo.
      </p>
    </div>
  );
}
