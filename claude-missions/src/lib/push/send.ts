import webpush from "web-push";

import { apnsConfigFromEnv, sendToApns } from "./apns";
import { fcmConfigFromEnv, sendToFcm } from "./fcm";
import type { MealNudgeReason, MealSlot } from "./meal-rhythm";

// Podsetnici: the thin wrapper around `web-push` — VAPID config, one typed
// payload shape, and the "a dead subscription must delete itself" rule.
//
// Kept apart from the routes so both the cron sender and the "pošalji probnu
// notifikaciju" button go through exactly one code path: whatever the test
// button proves is literally what the scheduler does at noon.

/** One tappable button on the notification itself. */
export interface PushAction {
  /** Matched in the service worker's `notificationclick` handler. */
  action: string;
  title: string;
  /** In-app path this button opens. */
  url: string;
}

/** What the service worker's `push` handler expects to receive. */
export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is tapped. */
  url: string;
  /** Groups/replaces notifications so a reminder can never stack up. */
  tag: string;
  /**
   * Buttons on the notification (2026-08-01).
   *
   * The reason people don't log a meal is friction, not forgetting: "Slikaj"
   * lands on the camera instead of on the home screen, saving two taps at the
   * exact moment the user has already decided to comply. Android and desktop
   * render these; iOS mostly ignores them and shows the plain notification,
   * which is why the body text must always stand on its own.
   */
  actions?: PushAction[];
}

/** How a given device is reached. See `0030_native_push.sql`. */
export type PushPlatform = "web" | "ios" | "android";

/**
 * One device, whatever it runs.
 *
 * A web row carries the Web Push triple; an iOS or Android row carries a single
 * device token instead. The database enforces that a row is one or the other
 * (`push_subscriptions_platform_shape`), so the nulls below are not a "maybe" —
 * they are determined by `platform`.
 */
export interface StoredSubscription {
  id: string;
  platform: PushPlatform;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  deviceToken: string | null;
}

/**
 * A `push_subscriptions` row as it comes back from Supabase, in the one shape
 * the sender wants.
 *
 * Shared by both callers (the cron sender and the "pošalji probnu" button) so
 * neither can forget a column and quietly stop delivering to a whole platform —
 * which is exactly what a missing `platform` would do: every native row would
 * read as `undefined` and fall through to the Web Push branch.
 */
export function toStoredSubscription(row: {
  id: string;
  platform: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  device_token: string | null;
}): StoredSubscription {
  return {
    id: row.id,
    // Rows created before 0030 have the column defaulted to 'web' in the
    // database; the fallback covers a client that selected an older shape.
    platform: (row.platform ?? "web") as PushPlatform,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    deviceToken: row.device_token,
  };
}

/** The columns `toStoredSubscription` needs, for `.select(...)`. */
export const SUBSCRIPTION_COLUMNS =
  "id, platform, endpoint, p256dh, auth, device_token";

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
 * Sends one payload to one device, over whichever transport that device uses.
 *
 * This function is the ONLY place the three transports meet. Everything above
 * it — who is due (`due.ts`), what it says (the payload builders below) — is
 * written once and knows nothing about APNs, FCM or VAPID. That is the whole
 * design: going to the stores changed the last hop and nothing else.
 *
 * A 404/410 from a push service is not an error worth retrying: it means the
 * user uninstalled the app, revoked permission, or the device rotated its
 * token. All three transports report that as `"gone"` so the caller can delete
 * the row and stop paying for it on every run.
 */
export async function sendToSubscription(
  subscription: StoredSubscription,
  payload: PushPayload
): Promise<SendResult> {
  if (subscription.platform === "ios") {
    return sendToApple(subscription, payload);
  }
  if (subscription.platform === "android") {
    return sendToAndroid(subscription, payload);
  }

  // A web row without an endpoint cannot exist (the CHECK constraint forbids
  // it), but the types do not know that and a crash in the fan-out would take
  // every other device down with it.
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return {
      status: "failed",
      id: subscription.id,
      message: "web pretplata bez endpointa",
    };
  }

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

/**
 * iOS, via APNs.
 *
 * An unconfigured Apple environment is reported as a plain failure rather than
 * thrown: until the developer account and the `.p8` key exist, iOS rows simply
 * cannot be delivered to, and that must not stop the Android and web devices in
 * the same fan-out.
 */
async function sendToApple(
  subscription: StoredSubscription,
  payload: PushPayload
): Promise<SendResult> {
  const config = apnsConfigFromEnv();
  if (!config || !subscription.deviceToken) {
    return {
      status: "failed",
      id: subscription.id,
      message: config ? "iOS uređaj bez tokena" : "APNs ključ nije podešen",
    };
  }

  const result = await sendToApns(config, subscription.deviceToken, payload);
  if (result.status === "sent") return { status: "sent", id: subscription.id };
  if (result.status === "gone") return { status: "gone", id: subscription.id };
  return {
    status: "failed",
    id: subscription.id,
    statusCode: result.statusCode,
    message: result.message,
  };
}

/** Android, via FCM. Same contract as `sendToApple`. */
async function sendToAndroid(
  subscription: StoredSubscription,
  payload: PushPayload
): Promise<SendResult> {
  const config = fcmConfigFromEnv();
  if (!config || !subscription.deviceToken) {
    return {
      status: "failed",
      id: subscription.id,
      message: config
        ? "Android uređaj bez tokena"
        : "FCM servisni nalog nije podešen",
    };
  }

  const result = await sendToFcm(config, subscription.deviceToken, payload);
  if (result.status === "sent") return { status: "sent", id: subscription.id };
  if (result.status === "gone") return { status: "gone", id: subscription.id };
  return {
    status: "failed",
    id: subscription.id,
    statusCode: result.statusCode,
    message: result.message,
  };
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

/** The camera, one tap from the notification. `/dodaj/obrok` is the photo flow
 * itself, not the add menu — the button promises a photo, so it opens one. */
const SHOOT_ACTION: PushAction = {
  action: "slikaj",
  title: "Slikaj",
  url: "/dodaj/obrok",
};

const MEAL_SLOT_TITLES: Record<MealSlot, string> = {
  breakfast: "Doručak još nije upisan",
  lunch: "Ručak još nije upisan",
  dinner: "Večera još nije upisana",
};

/**
 * The meal nudge — the replacement for the old fixed-time morning push.
 *
 * It knows WHICH meal is missing, because it is timed off the user's own median
 * logging time (`meal-rhythm.ts`), so it can name it. Naming it is most of the
 * value: "upiši doručak" at 10:00 is advice, "ručak još nije upisan" at 14:15
 * is an observation the user can check against their own morning.
 */
export function mealPayload(reason: MealNudgeReason): PushPayload {
  const base = { url: "/dodaj/obrok", tag: "fitmess-obrok", actions: [SHOOT_ACTION] };

  if (reason.kind === "slot") {
    return {
      ...base,
      title: MEAL_SLOT_TITLES[reason.slot],
      body: "Slikaj ga i gotovo — traje 10 sekundi.",
    };
  }

  const hours = Math.floor(reason.sinceMinutes / 60);
  return {
    ...base,
    title: `${hours} ${hourWord(hours)} bez upisa`,
    body: "Ako si nešto jeo u međuvremenu, upiši dok se sećaš.",
  };
}

/** Serbian hour count: 1 sat, 2–4 sata, 5+ sati. */
function hourWord(count: number): string {
  if (count === 1) return "sat";
  return count >= 2 && count <= 4 ? "sata" : "sati";
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
  /** True when this person logs training and today has none (0026/0027). */
  missingWorkout?: boolean;
}

/**
 * The evening close-out.
 *
 * It is only ever sent when it has something to say (`eveningHasSomethingToSay`
 * in `due.ts` decides that) — the version that went out every night at 20:00
 * regardless is what taught people to swipe these away.
 *
 * The tone rule is the app's existing one: an overshoot is reported, never
 * scolded.
 */
export function eveningPayload(recap: EveningRecap): PushPayload {
  const base = { url: "/danas", tag: "fitmess-vece" } as const;

  if (recap.loggedMeals === 0) {
    return {
      ...base,
      // "Dan ti je još prazan" made the empty day a fact about the PERSON;
      // this states what the app does or doesn't have (task "101"). A push
      // arrives uninvited, so it is the last place that may sound like a
      // verdict.
      title: "Danas još nema upisa",
      body: "Ako si nešto jeo, upiši dok se sećaš.",
    };
  }

  // The training question comes before the calorie report: food is written
  // down (that is what got us past the branch above), so the thing actually
  // missing from the day is the session. Asked ONLY of people who log
  // training — see `usesWorkouts` in `due.ts`.
  if (recap.missingWorkout) {
    return {
      ...base,
      // "pa ti je dan kompletan" quietly graded every rest day as incomplete.
      // A day without training is a normal day, and the copy now says so.
      title: "Nema upisanog treninga",
      body: "Ako si se kretao, upiši — ako nisi, dan je bio miran i to je to.",
      url: "/dodaj/trening",
      actions: [{ action: "trening", title: "Upiši trening", url: "/dodaj/trening" }],
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
