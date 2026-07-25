import webpush from "web-push";

// Podsetnici: the thin wrapper around `web-push` — VAPID config, one typed
// payload shape, and the "a dead subscription must delete itself" rule.
//
// Kept apart from the routes so both the cron sender and the "pošalji probnu
// notifikaciju" button go through exactly one code path: whatever the test
// button proves is literally what the scheduler does at noon.

/** What the service worker's `push` handler expects to receive. */
export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped. */
  url: string;
  /** Groups/replaces notifications so a reminder can never stack up. */
  tag: string;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Outcome per device: sent, or gone (the row should be deleted), or failed. */
export type SendResult =
  | { status: "sent"; id: string }
  | { status: "gone"; id: string }
  | { status: "failed"; id: string; statusCode?: number; message: string };

let configured = false;

/**
 * Loads the VAPID identity from the environment. Returns false when the keys
 * are missing, so a caller can answer with a clear Serbian message instead of
 * throwing a 500 that says nothing (this happens on any deployment where the
 * env vars were not copied over).
 */
export function configureWebPush(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends one payload to one device.
 *
 * A 404/410 from the push service is not an error we should retry: it means the
 * user uninstalled the app, revoked permission, or the browser rotated the
 * endpoint. Those come back as `"gone"` so the caller can delete the row and
 * stop paying for it on every run.
 */
export async function sendToSubscription(
  subscription: StoredSubscription,
  payload: PushPayload
): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 }
    );
    return { status: "sent", id: subscription.id };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      return { status: "gone", id: subscription.id };
    }

    return {
      status: "failed",
      id: subscription.id,
      statusCode,
      message: error instanceof Error ? error.message : "nepoznata greška",
    };
  }
}

/** Fan-out to every device a user has. Never throws; one dead device can't
 * stop the others. */
export async function sendToAll(
  subscriptions: readonly StoredSubscription[],
  payload: PushPayload
): Promise<SendResult[]> {
  return Promise.all(
    subscriptions.map((subscription) =>
      sendToSubscription(subscription, payload)
    )
  );
}

/** The one reminder v1 ships. Copy lives here so the cron and the test button
 * cannot drift apart. */
export function noLogReminderPayload(): PushPayload {
  return {
    title: "Danas još nisi ništa uneo",
    body: "Otvori FitMess i upiši šta si jeo — traje 10 sekundi.",
    url: "/danas",
    tag: "fitmess-nema-unosa",
  };
}

/** The "does this even work?" push, fired by the button in Podešavanja. */
export function testPayload(): PushPayload {
  return {
    title: "Radi! 🎉",
    body: "Ovako će izgledati tvoj podsetnik.",
    url: "/profil/podsetnici",
    tag: "fitmess-proba",
  };
}
