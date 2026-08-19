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
 * ## No nonce, deliberately
 *
 * Supabase's documented native-Google recipe passes no nonce, and the token
 * never leaves the process: the SDK hands it to this function, which hands it
 * to Supabase over TLS. A nonce guards against a replayed token arriving from
 * somewhere else, which this path has no room for. Adding one anyway would put
 * a value Google echoes and Supabase re-checks in the middle of a flow whose
 * every failure costs a full build cycle to observe.
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

  const login = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"] },
  });

  // Tokens are nested under `result` — `login.idToken` is always undefined and
  // reads like a Google failure when it is really a shape mistake here.
  const result = login.result as { idToken?: string | null } | undefined;
  const idToken = result?.idToken;
  if (!idToken) {
    throw new Error("Google did not return an ID token");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
}
