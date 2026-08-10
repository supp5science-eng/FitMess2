"use client";

// Podsetnici, native half: the same two verbs as `client.ts` — turn this device
// on, turn it off — for a phone that installed FitMess from a store.
//
// Web Push does not exist inside WKWebView or Android's WebView, so there is no
// endpoint/p256dh/auth triple to hand the server. There is one opaque device
// token instead, minted by APNs or FCM, and delivery goes through the OS. What
// does NOT change is anything above the transport: the same
// `/api/podsetnici/pretplata` row, the same `due.ts` schedule, the same
// payloads. Only the last hop differs.
//
// The registration handshake is the part worth reading twice. `register()`
// resolves as soon as the OS has been ASKED, not when it has answered — the
// token arrives later on the `registration` event, and when registration fails
// nothing arrives except `registrationError`. A caller that awaits `register()`
// and then reads a token gets `undefined` every time. So: listen first,
// register second, and give up after a while rather than leaving a switch
// spinning forever on a phone with no network.

import {
  nativePlatform,
  pushNotificationsPlugin,
  type NativeListenerHandle,
  type NativePushActionEvent,
  type PushNotificationsPlugin,
} from "@/lib/native/capacitor-bridge";

import type { SubscribeResult } from "./client";

/**
 * How long to wait for APNs/FCM to answer with a token.
 *
 * Generous on purpose: a cold first registration on a weak connection is
 * genuinely slow, and the cost of being early is telling a user their
 * reminders failed when they were about to work.
 */
const TOKEN_TIMEOUT_MS = 15_000;

const DENIED_SR =
  "Notifikacije su blokirane za FitMess. Uključi ih u podešavanjima telefona pa se vrati.";
const FAILED_SR = "Nismo uspeli da uključimo podsetnike. Pokušaj ponovo.";
const UNSUPPORTED_SR = "Ovaj uređaj ne podržava notifikacije.";
const TIMEOUT_SR =
  "Nismo uspeli da povežemo uređaj sa notifikacijama. Proveri internet pa pokušaj ponovo.";

/** `"ios"` / `"android"`, or null when this is not the store app. */
export function nativePushPlatform(): "ios" | "android" | null {
  const platform = nativePlatform();
  return platform === "ios" || platform === "android" ? platform : null;
}

/**
 * Can this device receive native push at all?
 *
 * False in every browser, and false in a shell built before the plugin was
 * bundled — a build that is already installed on someone's phone and whose
 * settings screen must degrade to an explanation, not an error.
 */
export function canUseNativePush(): boolean {
  return nativePushPlatform() !== null && pushNotificationsPlugin() !== null;
}

type TokenOutcome =
  | { ok: true; token: string }
  | { ok: false; reason: "failed" | "timeout" };

/**
 * Registers with the OS push service and resolves with the device token.
 *
 * Both listeners are attached BEFORE `register()` is called: the events can
 * fire on the very next tick, and a listener attached after the fact would miss
 * the only notification it will ever get.
 */
async function awaitDeviceToken(
  plugin: PushNotificationsPlugin
): Promise<TokenOutcome> {
  const handles: NativeListenerHandle[] = [];

  const cleanup = async () => {
    await Promise.all(
      handles.map((handle) => handle.remove().catch(() => undefined))
    );
  };

  try {
    const outcome = await new Promise<TokenOutcome>((resolve) => {
      let settled = false;
      const finish = (result: TokenOutcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(
        () => finish({ ok: false, reason: "timeout" }),
        TOKEN_TIMEOUT_MS
      );

      void (async () => {
        try {
          handles.push(
            await plugin.addListener("registration", (token) => {
              const value = token?.value?.trim();
              finish(
                value
                  ? { ok: true, token: value }
                  : { ok: false, reason: "failed" }
              );
            })
          );
          handles.push(
            await plugin.addListener("registrationError", () => {
              finish({ ok: false, reason: "failed" });
            })
          );

          await plugin.register();
        } catch {
          finish({ ok: false, reason: "failed" });
        }
      })();
    });

    return outcome;
  } finally {
    // Whatever happened, these two listeners were for one registration only.
    // Leaving them attached would mean a later token rotation resolves a
    // promise nobody is waiting on any more.
    await cleanup();
  }
}

/**
 * Asks the OS for permission, registers this device, and stores its token.
 *
 * Must be called from a user gesture, same as the web path — iOS refuses a
 * permission prompt that no tap asked for.
 */
export async function enableNativePush(): Promise<SubscribeResult> {
  const platform = nativePushPlatform();
  const plugin = pushNotificationsPlugin();

  if (!platform || !plugin) {
    return { ok: false, reason: "unsupported", message: UNSUPPORTED_SR };
  }

  try {
    // Ask only when there is something to ask. `requestPermissions()` on an
    // already-denied device resolves 'denied' immediately without showing
    // anything, which reads to the user as a tap that did nothing — so the
    // denial is turned into a sentence instead.
    const current = await plugin.checkPermissions();
    const decision =
      current.receive === "granted"
        ? current
        : await plugin.requestPermissions();

    if (decision.receive !== "granted") {
      return { ok: false, reason: "denied", message: DENIED_SR };
    }

    const token = await awaitDeviceToken(plugin);
    if (!token.ok) {
      return {
        ok: false,
        reason: "failed",
        message: token.reason === "timeout" ? TIMEOUT_SR : FAILED_SR,
      };
    }

    const response = await fetch("/api/podsetnici/pretplata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform,
        deviceToken: token.token,
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
 * Unregisters this device and forgets its token server-side.
 *
 * The token has to be read back the same way it was obtained — there is no
 * "current token" getter on the plugin — so this re-registers briefly to learn
 * what to delete. If that fails the DELETE is skipped: `unregister()` has
 * already stopped delivery, and a stale row costs one dead send that the 410 /
 * UNREGISTERED cleanup in `send.ts` removes on its own.
 */
export async function disableNativePush(): Promise<void> {
  const plugin = pushNotificationsPlugin();
  if (!plugin) return;

  try {
    const token = await awaitDeviceToken(plugin);
    if (token.ok) {
      await fetch("/api/podsetnici/pretplata", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceToken: token.token }),
      });
    }
    await plugin.unregister();
  } catch {
    // Best effort, same as the web path: the device stops getting reminders
    // because the preference itself is off server-side.
  }
}

/**
 * Wires "tap the notification, land on the right screen".
 *
 * Without this a tap opens the app on whatever screen it was last on, which
 * makes a reminder about an unlogged lunch feel like a nudge with no follow-
 * through. `url` is put in the payload's data map by `send.ts`; anything else
 * (or a missing one) falls back to the home screen rather than navigating
 * somewhere arbitrary.
 */
export async function listenForNativePushTaps(
  navigate: (url: string) => void
): Promise<NativeListenerHandle | null> {
  const plugin = pushNotificationsPlugin();
  if (!plugin) return null;

  try {
    return await plugin.addListener(
      "pushNotificationActionPerformed",
      (action: NativePushActionEvent) => {
        const raw = action?.notification?.data?.url;
        const url = typeof raw === "string" ? raw : "";
        // Only in-app paths: a push payload is attacker-shaped input if the
        // sending key ever leaks, and "/..." can never become an external
        // origin. `//host` would, which is why the second character is checked.
        navigate(url.startsWith("/") && !url.startsWith("//") ? url : "/danas");
      }
    );
  } catch {
    return null;
  }
}
