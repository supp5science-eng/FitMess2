/**
 * F071: the one place `web-push` is configured and invoked. Server-only —
 * VAPID_PRIVATE_KEY must never reach a client bundle.
 *
 * VAPID (RFC 8292) is how our server identifies itself to the browser push
 * services (FCM/Mozilla/APNs web push): the public key is baked into each
 * client subscription, the private key signs every send. Keys live only in
 * env (see .env.example), generated once via `npx web-push generate-vapid-keys`.
 */

import webpush from "web-push";

import type { ReminderPayload } from "@/lib/push/reminders";

export type PushSendOutcome = "sent" | "gone" | "failed";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:podrska@fitmess.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends one payload to one stored subscription.
 *  - `sent`  — the push service accepted it;
 *  - `gone`  — the subscription is dead (404/410: uninstalled, permission
 *              revoked, endpoint rotated) and the caller should delete its row;
 *  - `failed` — transient/other error; keep the row, a later run may succeed.
 */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: ReminderPayload
): Promise<PushSendOutcome> {
  if (!ensureConfigured()) {
    console.error("[push] VAPID keys missing — set VAPID_* env vars");
    return "failed";
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      // The reminder is only relevant for a few hours; don't let push
      // services retry it into tomorrow.
      { TTL: 4 * 60 * 60, urgency: "normal" }
    );
    return "sent";
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : null;
    if (statusCode === 404 || statusCode === 410) return "gone";
    console.error("[push] send failed:", error);
    return "failed";
  }
}
