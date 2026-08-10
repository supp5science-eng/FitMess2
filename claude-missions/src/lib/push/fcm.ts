import { createSign } from "node:crypto";

import type { PushPayload } from "./send";

/**
 * Delivery to an Android phone that installed FitMess from Google Play.
 *
 * Android's WebView has no Push API either, so the shell registers with
 * Firebase Cloud Messaging through `@capacitor/push-notifications` and hands us
 * an FCM token.
 *
 * Two things worth knowing before touching this:
 *
 *  - **The legacy `key=AIza...` server key is gone.** FCM's HTTP v1 API is the
 *    only one left, and it authenticates with a short-lived OAuth2 access token
 *    minted from a *service account* — a different file from the
 *    `google-services.json` the Android app ships with. Confusing those two is
 *    the usual reason this returns 401 forever.
 *  - **Unlike APNs, this is ordinary HTTPS**, so plain `fetch` is enough and
 *    there is no HTTP/2 requirement.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Google issues these for an hour; refresh a few minutes early. */
const TOKEN_SKEW_MS = 5 * 60 * 1000;

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Reads the Firebase service account from the environment.
 *
 * Accepts the whole service-account JSON in `FCM_SERVICE_ACCOUNT` — which is
 * how the file arrives from the Firebase console, so it can be pasted in one
 * piece rather than split into three env vars by hand and mistyped.
 *
 * Returns null when unset, so the sender skips Android devices quietly on a
 * deployment where Firebase has not been set up yet.
 */
export function fcmConfigFromEnv(): FcmConfig | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const account = parsed as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };

    if (
      typeof account.project_id !== "string" ||
      typeof account.client_email !== "string" ||
      typeof account.private_key !== "string"
    ) {
      return null;
    }

    return {
      projectId: account.project_id,
      clientEmail: account.client_email,
      // Same newline problem as the APNs key: dashboards store the PEM with
      // literal "\n" sequences.
      privateKey: account.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    // A malformed paste is a configuration error, not a runtime one -- treat
    // it as "not configured" so reminders to other platforms still go out.
    return null;
  }
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

/**
 * Exchanges a self-signed JWT for a Google access token.
 *
 * This is the whole of `google-auth-library` for our one use: sign a claim set
 * saying "I am this service account and I want the messaging scope", hand it to
 * Google, get a bearer token back.
 */
async function accessToken(config: FcmConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.value;
  }

  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: FCM_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );

  // RS256 here, not ES256: a Google service-account key is RSA, and its
  // signature is plain PKCS#1 -- no `dsaEncoding` dance like APNs needs.
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(config.privateKey)
    .toString("base64url");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) return null;

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as { access_token?: unknown }).access_token !== "string"
  ) {
    return null;
  }

  const token = (data as { access_token: string; expires_in?: number }).access_token;
  const expiresIn = (data as { expires_in?: number }).expires_in ?? 3600;
  cachedAccessToken = {
    value: token,
    expiresAt: now + expiresIn * 1000 - TOKEN_SKEW_MS,
  };
  return token;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export type FcmResult =
  | { status: "sent" }
  | { status: "gone"; reason: string }
  | { status: "failed"; statusCode?: number; message: string };

/**
 * Sends one payload to one Android phone.
 *
 * `notification` is what the system tray renders; `data` carries the in-app
 * path so the tap handler knows where to go. The `tag` is passed as Android's
 * own collapse tag, giving the same "replace, never stack" behaviour the web
 * payload gets from its `tag`.
 */
export async function sendToFcm(
  config: FcmConfig,
  deviceToken: string,
  payload: PushPayload
): Promise<FcmResult> {
  const token = await accessToken(config);
  if (!token) {
    return { status: "failed", message: "FCM: nije uspela prijava servisnog naloga" };
  }

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: payload.title, body: payload.body },
            // Everything the tap handler needs must be a string: FCM's data
            // map is string-to-string and silently rejects anything else.
            data: { url: payload.url, tag: payload.tag },
            android: {
              priority: "HIGH",
              // Mirrors the Web Push TTL -- a lunch reminder is worthless at
              // midnight, so it expires rather than arriving late.
              ttl: "3600s",
              collapse_key: payload.tag,
              notification: { tag: payload.tag },
            },
          },
        }),
      }
    );

    if (response.ok) return { status: "sent" };

    const detail = await response.text();
    // 404 means the token is not registered any more (uninstall, app data
    // cleared, token rotated). Permanent, so the row is deleted rather than
    // retried on every run -- the same rule as a 410 from a browser endpoint.
    if (response.status === 404 || detail.includes("UNREGISTERED")) {
      return { status: "gone", reason: "UNREGISTERED" };
    }
    // A token that was never valid: FCM answers 400 INVALID_ARGUMENT. Also
    // permanent -- retrying a malformed token forever costs a request a day
    // and never succeeds.
    if (response.status === 400 && detail.includes("INVALID_ARGUMENT")) {
      return { status: "gone", reason: "INVALID_ARGUMENT" };
    }

    return {
      status: "failed",
      statusCode: response.status,
      message: detail.slice(0, 200) || `FCM ${response.status}`,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "nepoznata FCM greška",
    };
  }
}

/** Test seam: forget the cached access token. */
export function resetFcmState(): void {
  cachedAccessToken = null;
}
