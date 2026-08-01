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

/** The morning nudge. Sent whether or not the user has logged — by 10:00 most
 * people have eaten but not written it down, which is exactly the gap. */
export function morningPayload(): PushPayload {
  return {
    title: "Dobro jutro 👋",
    body: "Upiši doručak dok ti je svež u glavi — traje 10 sekundi.",
    url: "/danas",
    tag: "fitmess-jutro",
  };
}

/**
 * The weekly weigh-in nudge (2026-08-01).
 *
 * Deliberately says WHY rather than just "weigh yourself": the ask only makes
 * sense once you know the app is going to do something with the number, and
 * "we'll check whether your plan still fits" is the whole bargain in one line.
 * Deep-links straight to `/merenje`, not to `/danas` -- a reminder that lands
 * you one tap short of the thing it asked for is a reminder people ignore.
 */
export function weighInPayload(): PushPayload {
  return {
    title: "Nedeljno merenje",
    body: "Izmeri se pa da vidimo da li ti plan i dalje odgovara.",
    url: "/merenje",
    tag: "fitmess-merenje",
  };
}

/** What the evening recap knows about the day it is reporting on. */
export interface EveningRecap {
  /** Logs the user made today. */
  loggedMeals: number;
  /** Whole kcal left in the day's budget; 0 once at/over it. */
  remainingKcal: number;
  /** Whole kcal past the budget; 0 while still under. */
  overshootKcal: number;
  /** False when the user has no daily target yet (fresh account). */
  hasTarget: boolean;
}

/**
 * The evening recap — the reminder that earns its place on a day the user DID
 * log, which is why the whole reminder system stopped skipping those days.
 *
 * Four things it can say, and the tone rule is the app's existing one: an
 * overshoot is reported, never scolded.
 */
export function eveningPayload(recap: EveningRecap): PushPayload {
  const base = { url: "/danas", tag: "fitmess-vece" } as const;

  if (recap.loggedMeals === 0) {
    return {
      ...base,
      title: "Dan ti je još prazan",
      body: "Upiši šta si danas jeo — bolje i na brzinu nego nikako.",
    };
  }

  // No target yet: reporting "ostalo ti je 0 kcal" would be a lie dressed as
  // arithmetic, so it just acknowledges the day.
  if (!recap.hasTarget) {
    return {
      ...base,
      title: "Kako je prošao dan?",
      body: `Upisao si ${mealWord(recap.loggedMeals)} danas. Baci pogled na Analitiku.`,
    };
  }

  if (recap.overshootKcal > 0) {
    return {
      ...base,
      title: "Dan je zatvoren",
      body: `Prešao si ${recap.overshootKcal} kcal preko plana. Sutra se izravna — plan to već računa.`,
    };
  }

  return {
    ...base,
    title: `Ostalo ti je ${recap.remainingKcal} kcal`,
    body: `Upisao si ${mealWord(recap.loggedMeals)} danas. Ima li još nešto za upis?`,
  };
}

/** Serbian meal count: 1 obrok, 2–4 obroka, 5+ obroka. */
function mealWord(count: number): string {
  return count === 1 ? "1 obrok" : `${count} obroka`;
}

/**
 * The earned one: three meals logged, day complete.
 *
 * `streak` is how many consecutive days now end this way — the number the
 * reward screen animates up to, repeated here so the notification itself
 * already carries the good news.
 */
export function awardPayload(streak: number): PushPayload {
  return {
    title: "Pun dan! 🏆",
    body:
      streak > 1
        ? `Tri obroka upisana — ${streak} dana zaredom. Otvori da vidiš.`
        : "Tri obroka upisana. Otvori da pokupiš značku.",
    url: "/nagrada",
    tag: "fitmess-nagrada",
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
