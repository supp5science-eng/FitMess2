"use client";

import { SocialLogin } from "@capgo/capacitor-social-login";

import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/lib/auth/google-clients";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign in with Google INSIDE the native shell, without the web view.
 *
 * ## Why this file exists
 *
 * The ordinary web flow (`useOAuthSignIn` → `signInWithOAuth`) navigates the
 * web view to Google's consent page. Google allows that request — measured
 * with four User-Agents, all served an ordinary sign-in page — but it enforces
 * its embedded-web-view policy INSIDE the flow rather than at the door: tapped
 * in a TestFlight build, Google offered no saved accounts and interrupted with
 * an extra verification step. The button was pulled from the shell on
 * 19.08.2026 for that reason.
 *
 * Pulling it was never the goal. This is the version that works: the platform's
 * own Google account picker (a system surface, not our web view, so the policy
 * does not apply), which hands back an OpenID **ID token**. Supabase accepts
 * that token directly via `signInWithIdToken` — no consent page, no redirect
 * out of the app, no deep link back into it, and the account the phone is
 * already signed into is right there in the sheet.
 *
 * ## What must be true elsewhere for this to work
 *
 * 1. An **iOS** OAuth client in the same Google Cloud project as the web one,
 *    keyed to bundle id `app.fitmess` — `GOOGLE_IOS_CLIENT_ID` below.
 * 2. That client's REVERSED id registered as a URL scheme in
 *    `ios/App/App/Info.plist`; the Google SDK refuses to start without it.
 * 3. Supabase's Google provider listing the iOS client id under *Authorized
 *    Client IDs*, because the ID token's audience is the iOS client, not the
 *    web one. Without it Supabase rejects a perfectly valid token.
 *
 * All three are console work that no `git push` can reach. Until step 1 is
 * done, `GOOGLE_IOS_CLIENT_ID` stays empty and `canSignInWithGoogleNatively()`
 * answers `false`, which is what keeps the button off the shell's sign-in
 * screens — a Google button that fails at the tap is worse than no button, and
 * that is the whole lesson of this feature.
 *
 * ## The nonce, and why it cannot be skipped
 *
 * The first device test failed here with `Passed nonce and nonce in id_token
 * should either both exist or not` — because **Google's iOS SDK mints a nonce
 * of its own** when the caller supplies none. The token therefore arrived
 * carrying a nonce that this code had no way to know, and Supabase, seeing a
 * claim it was given nothing to compare against, refused it. Passing no nonce
 * is not an option; it only looks like one.
 *
 * So the nonce is ours, and it travels two ways on purpose:
 *
 *  - **Google gets the SHA-256 hash.** It echoes whatever it is given straight
 *    into the `nonce` claim, so what lands in the token is the hash.
 *  - **Supabase gets the raw value.** It hashes it itself and compares.
 *
 * That is the shape Supabase's own native-sign-in recipe uses, and it is what
 * makes the check meaningful: a token replayed from somewhere else carries a
 * hash whose original the attacker does not have.
 */

let initialized = false;

/**
 * `SocialLogin.initialize` is idempotent from our side but not free — it wires
 * up the native SDK — so it runs once per page life, on the first tap rather
 * than at import time. A user who never taps Google never pays for it.
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      // The ID token has to be minted for the audience Supabase trusts.
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    },
  });
  initialized = true;
}

/**
 * Runs the native sign-in and puts the resulting session in the same cookies
 * the rest of the app reads.
 *
 * Resolves once the session is stored; the caller then does a FULL page load
 * (not a client-side route change) so the middleware re-runs against the new
 * cookies and routes to the phone ask / onboarding / `/danas` exactly as it
 * would after any other sign-in.
 *
 * Throws on any failure — including the user simply closing the sheet, which
 * the SDK also reports as an error. The caller turns that into the one generic
 * Serbian message; nothing here is worth telling a user about in detail.
 */
export async function signInWithGoogleNatively(): Promise<void> {
  await ensureInitialized();

  const rawNonce = createRawNonce();
  const login = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      nonce: await sha256Hex(rawNonce),
      // NOT a UX preference — it is what keeps the nonce above meaningful.
      // Without it the plugin takes a shortcut whenever the SDK remembers a
      // previous sign-in: it restores that session and refreshes its tokens,
      // returning an ID token minted for the nonce of the ORIGINAL sign-in.
      // The nonce we just generated would never reach Google, and Supabase
      // would reject the mismatch — on the second tap onwards only, which is
      // the kind of bug that looks like flakiness. Always ask.
      forcePrompt: true,
    },
  });

  // Tokens are nested under `result` — `login.idToken` is always undefined and
  // reads like a Google failure when it is really a shape mistake here.
  const result = login.result as { idToken?: string | null } | undefined;
  const idToken = result?.idToken;
  if (!idToken) {
    throw new NativeGoogleError("no ID token in login result", {
      keys: Object.keys(result ?? {}).join(",") || "none",
    });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    // Raw, not hashed — Supabase does the hashing on its side.
    nonce: rawNonce,
  });
  if (error) {
    // The token was minted; Supabase refused it. Which of the two is wrong is
    // the whole question, and it is answered by the token's own claims — so
    // they travel with the error rather than being guessed at afterwards.
    throw new NativeGoogleError(error.message, {
      status: String(error.status ?? ""),
      ...describeIdToken(idToken),
    });
  }
}

/** A single-use random value, long enough that guessing it is not a strategy. */
function createRawNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hex SHA-256 — what Google is handed, so the token carries the hash rather
 * than the secret. `crypto.subtle` needs a secure context, which the shell
 * always has: it loads the site over https.
 */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * An error that carries what the screen needs to say something useful.
 *
 * This exists because the first device test of this flow produced "Došlo je do
 * greške" and nothing else — a message that is right for a user and useless for
 * anyone trying to fix it. Every failure mode here (wrong audience, provider
 * off, nonce mismatch, no token) looks identical from the outside and different
 * in one field of the token or the response.
 */
export class NativeGoogleError extends Error {
  readonly detail: string;

  constructor(message: string, fields: Record<string, string>) {
    super(message);
    this.name = "NativeGoogleError";
    this.detail = Object.entries(fields)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
  }
}

/**
 * The claims that decide whether Supabase may accept this token, read straight
 * off the JWT. No signature check and none needed: this is a diagnostic, and
 * the token has already been rejected by the only party whose verdict counts.
 *
 * `aud` is shortened because the interesting part of a Google client id is its
 * middle, and the full value does not fit on a phone screen.
 */
function describeIdToken(token: string): Record<string, string> {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { aud?: string; iss?: string; nonce?: string; azp?: string };
    return {
      aud: (payload.aud ?? "?").replace(/\.apps\.googleusercontent\.com$/, ""),
      iss: (payload.iss ?? "?").replace(/^https:\/\//, ""),
      nonce: payload.nonce ? "yes" : "no",
    };
  } catch {
    return { token: "unreadable" };
  }
}
