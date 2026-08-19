/**
 * The Google OAuth client ids the native sign-in needs, and the one flag that
 * says whether it is usable yet.
 *
 * A module of its own, with no `"use client"`, because both sides need it: the
 * client hook that talks to the Google SDK (`./google-native`) and the SERVER
 * component that decides whether to render the button at all. An export from a
 * `"use client"` module is a client reference — a server component cannot call
 * it — so putting these two lines in there would render the gate uncallable
 * exactly where the gate has to be enforced.
 */

/**
 * The WEB client id — the one Supabase's Google provider is configured with,
 * and the audience the shell asks Google to mint its ID token for.
 *
 * Hardcoded, like the Supabase host in `capacitor.config.ts` and for the same
 * reason: this value is needed where `process.env` is not reliably populated,
 * and a silent `undefined` here produces a sign-in that fails at the tap with
 * nothing in any log. It is a public identifier — it travels in the query
 * string of every OAuth request the site already makes — not a secret.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "1004641833797-cu2ibrlh0ad00l30a0b68gp6d8t61vri.apps.googleusercontent.com";

/**
 * The iOS client id, from the same Google Cloud project.
 *
 * EMPTY UNTIL THE CONSOLE STEP IS DONE — see the header. Filling this in is
 * what turns the feature on, and it must land together with the matching URL
 * scheme in `Info.plist` and the Supabase *Authorized Client IDs* entry.
 */
export const GOOGLE_IOS_CLIENT_ID = "";

/**
 * Whether the native path is configured well enough to be offered at all.
 *
 * The button is gated on this rather than on "are we in the shell", because
 * everything that makes the native flow work lives in consoles a deploy cannot
 * reach — see the header of `./google-native`. Empty id, no button.
 */
export function canSignInWithGoogleNatively(): boolean {
  return GOOGLE_IOS_CLIENT_ID.length > 0;
}
