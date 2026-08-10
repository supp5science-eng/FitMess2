import { createSign } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";

import type { PushPayload } from "./send";

/**
 * Delivery to an iPhone that installed FitMess from the App Store.
 *
 * WKWebView has no Push API, so the shell registers with APNs through
 * `@capacitor/push-notifications` and hands us a device token. From here on it
 * is Apple's protocol, and two of its rules decide the shape of this file:
 *
 *  - **APNs is HTTP/2 only.** Node's `fetch` (undici) speaks HTTP/1.1, so it
 *    cannot be used at all — hence `node:http2`. This is also why this module
 *    can never run on an edge runtime.
 *  - **Authentication is a JWT signed with a `.p8` key**, not a bearer secret.
 *    Apple rate-limits token *generation* (a new one more often than every 20
 *    minutes earns a 429), so the token is cached and reused, exactly as the
 *    provider API documentation asks.
 *
 * Written against the protocol directly, with no SDK, for the same reason the
 * Gemini client is: this is four request headers and a signature, and an SDK
 * here would be a version to keep up with rather than a problem solved.
 */

const APNS_HOST_PRODUCTION = "api.push.apple.com";
const APNS_HOST_SANDBOX = "api.sandbox.push.apple.com";

/** Apple refuses a token minted more often than every 20 minutes and expires
 * one after 60. An hour of reuse with a wide margin is the sweet spot. */
const TOKEN_TTL_MS = 45 * 60 * 1000;

export interface ApnsConfig {
  /** Contents of the `.p8` file downloaded from developer.apple.com → Keys. */
  privateKey: string;
  /** The 10-character Key ID shown next to that key. */
  keyId: string;
  /** The 10-character Team ID from Membership details. */
  teamId: string;
  /** The app's bundle identifier — `app.fitmess`, and permanent. */
  bundleId: string;
  /**
   * Which Apple environment the token belongs to. A token from a TestFlight or
   * App Store build is a *production* token; one from a debug build installed
   * by Xcode is a sandbox token, and sending a token to the wrong environment
   * fails with `BadDeviceToken` — the single most common reason "push works on
   * my machine but not in review".
   */
  production: boolean;
}

/**
 * Reads the APNs identity from the environment.
 *
 * Returns null when it is not configured, so the sender can skip iOS devices
 * quietly instead of throwing on every run. A deployment without these keys is
 * the normal state until the Apple account is set up.
 */
export function apnsConfigFromEnv(): ApnsConfig | null {
  const privateKey = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;

  if (!privateKey || !keyId || !teamId) return null;

  return {
    // Env vars cannot hold real newlines in most dashboards, so the PEM is
    // pasted with literal "\n" and restored here.
    privateKey: privateKey.replace(/\\n/g, "\n"),
    keyId,
    teamId,
    bundleId: process.env.APNS_BUNDLE_ID ?? "app.fitmess",
    // Defaults to production: the builds that reach real users are the ones
    // that matter, and a sandbox deployment can opt out explicitly.
    production: process.env.APNS_SANDBOX !== "1",
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** The provider JWT, minted at most once per `TOKEN_TTL_MS`. */
function providerToken(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" })
  );
  const claims = base64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) })
  );

  // ES256 in a JWT is the raw r‖s pair, NOT the DER encoding Node produces by
  // default. Getting this wrong yields a well-formed token that Apple rejects
  // with a bare 403 InvalidProviderToken and no hint as to why.
  const signature = createSign("SHA256")
    .update(`${header}.${claims}`)
    .sign({ key: config.privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  const value = `${header}.${claims}.${signature}`;
  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** Thrown away between invocations; a warm lambda reuses the connection. */
let session: ClientHttp2Session | null = null;

function getSession(host: string): ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session;
  session = connect(`https://${host}`);
  // A connection error must not become an unhandled rejection that takes the
  // whole request down -- each send has its own error path.
  session.on("error", () => {
    session = null;
  });
  return session;
}

export type ApnsResult =
  | { status: "sent" }
  /** The token is dead: uninstalled, restored, or simply wrong. Delete it. */
  | { status: "gone"; reason: string }
  | { status: "failed"; statusCode?: number; message: string };

/**
 * Sends one payload to one iPhone.
 *
 * The `aps` dictionary is what iOS renders; `url` rides alongside it as custom
 * data and is read by the shell's tap handler to open the right screen. The
 * notification actions used on Android are deliberately not translated: iOS
 * needs categories registered at app launch to show buttons, and the copy is
 * already written so the body stands on its own without them.
 */
export async function sendToApns(
  config: ApnsConfig,
  deviceToken: string,
  payload: PushPayload
): Promise<ApnsResult> {
  const host = config.production ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      // Same job as the Web Push `tag`: a second reminder replaces the first
      // in the notification centre instead of stacking on top of it.
      "thread-id": payload.tag,
    },
    url: payload.url,
    tag: payload.tag,
  });

  return new Promise<ApnsResult>((resolve) => {
    let settled = false;
    const settle = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const request = getSession(host).request({
        [constants.HTTP2_HEADER_METHOD]: "POST",
        [constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        [constants.HTTP2_HEADER_AUTHORIZATION]: `bearer ${providerToken(config)}`,
        "apns-topic": config.bundleId,
        // Reminders are alerts the user should see now, not silent background
        // wake-ups; `alert` + priority 10 is what iOS needs to display one.
        "apns-push-type": "alert",
        "apns-priority": "10",
        // Matches the Web Push TTL: a reminder about lunch is worthless at
        // midnight, so it should expire rather than arrive late.
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
        [constants.HTTP2_HEADER_CONTENT_TYPE]: "application/json",
        [constants.HTTP2_HEADER_CONTENT_LENGTH]: Buffer.byteLength(body),
      });

      let statusCode: number | undefined;
      let responseBody = "";

      request.setEncoding("utf8");
      request.on("response", (headers) => {
        statusCode = Number(headers[constants.HTTP2_HEADER_STATUS]);
      });
      request.on("data", (chunk: string) => {
        responseBody += chunk;
      });
      request.on("error", (error) => {
        settle({ status: "failed", message: error.message });
      });
      request.on("end", () => {
        if (statusCode === 200) return settle({ status: "sent" });

        const reason = parseApnsReason(responseBody);
        // 410 is Apple's "this token is no longer valid"; BadDeviceToken on a
        // 400 means the same thing for a token that never was. Both are
        // permanent, so the row goes rather than being retried forever.
        if (
          statusCode === 410 ||
          reason === "BadDeviceToken" ||
          reason === "Unregistered"
        ) {
          return settle({ status: "gone", reason: reason ?? "410" });
        }

        settle({
          status: "failed",
          statusCode,
          message: reason ?? `APNs ${statusCode ?? "bez odgovora"}`,
        });
      });

      request.end(body);
    } catch (error) {
      settle({
        status: "failed",
        message: error instanceof Error ? error.message : "nepoznata APNs greška",
      });
    }
  });
}

function parseApnsReason(body: string): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "reason" in parsed &&
      typeof (parsed as { reason?: unknown }).reason === "string"
    ) {
      return (parsed as { reason: string }).reason;
    }
  } catch {
    // Apple answers with JSON; anything else is a proxy or an outage page.
  }
  return null;
}

/** Test seam: forget the cached provider JWT (and any open connection). */
export function resetApnsState(): void {
  cachedToken = null;
  session?.destroy();
  session = null;
}
