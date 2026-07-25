"use client";

// Podsetnici: the browser half — permission, subscription, and the two little
// truths the settings screen has to tell the user honestly.
//
// The awkward part of Web Push on this product is Apple's: on iOS/iPadOS,
// `Notification` and `PushManager` exist in Safari but a site can only actually
// subscribe when it is running as an INSTALLED Home Screen app. So "your
// browser supports notifications" is not the question worth asking — "can THIS
// window subscribe?" is, and that is what `pushEnvironment()` answers.

export type PushEnvironment =
  | { state: "ready" }
  /** iOS/iPadOS Safari tab: must be installed to the Home Screen first. */
  | { state: "needs-install" }
  /** The browser has no Push API at all. */
  | { state: "unsupported" };

/** True when the page is running as an installed app (PWA), not a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosStandalone === true
  );
}

function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function pushEnvironment(): PushEnvironment {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    // On an iPhone this is almost always "you are in a Safari tab", which has a
    // fix the user can act on; elsewhere it is a genuinely unsupported browser.
    return isApple() ? { state: "needs-install" } : { state: "unsupported" };
  }

  if (isApple() && !isStandalone()) return { state: "needs-install" };

  return { state: "ready" };
}

/** The current permission, without prompting. */
export function notificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

/**
 * VAPID public key (base64url) -> the bytes `subscribe()` wants.
 *
 * Returns an `ArrayBuffer`, not a `Uint8Array`: TS 5.7+ types a plain
 * `Uint8Array` as `Uint8Array<ArrayBufferLike>`, which no longer satisfies
 * `BufferSource` (it could be backed by a `SharedArrayBuffer`). Handing over
 * the buffer itself sidesteps that without a cast.
 */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unsupported" | "failed"; message: string };

const DENIED_SR =
  "Notifikacije su blokirane za FitMess. Uključi ih u podešavanjima telefona pa se vrati.";
const FAILED_SR = "Nismo uspeli da uključimo podsetnike. Pokušaj ponovo.";
const UNSUPPORTED_SR = "Ovaj uređaj ne podržava notifikacije.";

/**
 * Asks for permission (must be called from a user gesture — iOS refuses
 * otherwise), subscribes this device, and stores it server-side.
 */
export async function enablePush(vapidPublicKey: string): Promise<SubscribeResult> {
  if (pushEnvironment().state !== "ready") {
    return { ok: false, reason: "unsupported", message: UNSUPPORTED_SR };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied", message: DENIED_SR };
    }

    const registration = await navigator.serviceWorker.ready;
    // An existing subscription is reused as-is: re-subscribing with the same
    // key returns the same endpoint anyway, and this keeps the row stable.
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
      }));

    const json = subscription.toJSON();
    const response = await fetch("/api/podsetnici/pretplata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 500),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error_sr?: string;
      } | null;
      return {
        ok: false,
        reason: "failed",
        message: body?.error_sr || FAILED_SR,
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: FAILED_SR };
  }
}

/**
 * Unsubscribes this device and forgets it server-side. The browser-side
 * `unsubscribe()` is what actually stops delivery; the DELETE just keeps us
 * from sending into the void.
 */
export async function disablePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/podsetnici/pretplata", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch {
    // Best effort: a device that fails to unsubscribe still stops getting
    // reminders because the setting itself is off server-side.
  }
}
