/**
 * F013: the pure redirect-decision logic for route protection (AS-011,
 * AS-012). Deliberately framework-free -- takes plain booleans/strings in,
 * returns a plain "allow or redirect-to-this-path" value out -- so it can be
 * unit-tested in isolation (no `NextRequest`/`NextResponse`, no live
 * Supabase project) and wired into `src/middleware.ts`, which owns turning
 * the decision into an actual `NextResponse`.
 *
 * Redirect matrix (per the clarified spec):
 *   - Unauthenticated + protected page -> `/prijava` (AS-011).
 *   - Authenticated, email not verified -> the F011 verification notice
 *     (`/registracija/proveri-email`) -- reuses the same provider-agnostic
 *     `isEmailVerified()` gate F012 introduced, so a Google-authenticated
 *     identity (pre-verified by Google) is never blocked here.
 *   - Authenticated + verified, `profiles.onboarded_at` still null ->
 *     `/onboarding`. Onboarding routes themselves are exempt from this rule
 *     so visiting `/onboarding` while not yet onboarded never redirect-loops
 *     back to itself.
 *   - Auth pages (`/prijava`, `/registracija*`) and the `/auth/*` callback
 *     endpoint are never gated. Once a user is fully set up (verified +
 *     onboarded), landing on `/prijava` or `/registracija*` bounces them to
 *     the app instead (AS-012's "afterwards protected pages redirect to
 *     login" is the mirror image of this: once signed out, the same pages
 *     stop bouncing and become reachable again).
 */

import { isLegalPath } from "@/lib/legal/paths";

export type RouteProtectionInput = {
  /** `request.nextUrl.pathname` -- no query string, no origin. */
  pathname: string;
  /** Whether `auth.getUser()` resolved a valid session for this request. */
  isAuthenticated: boolean;
  /** `isEmailVerified(user)` from `@/lib/auth/core` -- ignored when
   * `isAuthenticated` is false. */
  isEmailVerified: boolean;
  /** `profiles.onboarded_at IS NOT NULL` for the current user -- ignored
   * when `isAuthenticated` is false or the email isn't verified yet. */
  isOnboarded: boolean;
  /**
   * Whether the one-time, SKIPPABLE phone ask has nothing left to do —
   * `hasClearedPhonePrompt(...)` from `@/lib/auth/phone-prompt`. Despite the
   * name this is NOT "a phone number is on file": the number is optional
   * (guideline 5.1.1(v)), and a user who tapped "Preskoči" has cleared the ask
   * without giving one. Optional + defaults to cleared, so a caller that
   * doesn't care (most unit tests) never trips the gate.
   */
  hasPhone?: boolean;
  /** `isNativeAppUserAgent(...)` -- whether this request comes from the
   * App Store / Play shell rather than a browser. Only changes the answer for
   * `/`; see the note at the top of `decideRouteAccess`. Optional + defaults
   * to "browser" so every existing caller keeps its old behaviour. */
  isNativeShell?: boolean;
};

export type RouteDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string };

/** Where an unauthenticated visitor to a protected page is sent (AS-011). */
export const SIGNED_OUT_REDIRECT_PATH = "/prijava";
/** Where an authenticated-but-unverified visitor to a protected page is sent. */
export const VERIFY_EMAIL_NOTICE_PATH = "/registracija/proveri-email";
/** Where a verified-but-not-yet-onboarded visitor to a protected page is sent. */
export const ONBOARDING_PATH = "/onboarding";
/** Where a verified OAuth visitor who hasn't answered the optional phone ask
 * is sent once. Skippable — never a wall. */
export const PHONE_CAPTURE_PATH = "/telefon";
/** Where a fully set-up visitor landing on an auth page is bounced to. */
export const SIGNED_IN_HOME_PATH = "/danas";

const LOGIN_SIGNUP_PREFIXES = ["/prijava", "/registracija"];
const AUTH_CALLBACK_PREFIX = "/auth";
const MARKETING_HOME_PATH = "/";
/** The public, pre-auth onboarding questionnaire the landing "Kreni" CTA sends
 * new visitors to. Answered logged-out (answers stashed client-side), so it
 * must be reachable without a session — see `isPublicPath`. */
const QUESTIONNAIRE_PATH = "/upitnik";

/** The self-service password-recovery pages: the "forgot password" request
 * form and the "set a new password" form the recovery email lands on. Both are
 * public so a signed-out user who forgot their password can reach the request
 * form, and so the recovery-session user the email drops onto `/nova-lozinka`
 * is never bounced to `/onboarding` before they can set a new password. */
const PASSWORD_RESET_PREFIXES = ["/zaboravljena-lozinka", "/nova-lozinka"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** `/zaboravljena-lozinka` and `/nova-lozinka` -- the password-recovery flow. */
export function isPasswordResetPath(pathname: string): boolean {
  return PASSWORD_RESET_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** `/prijava` and `/registracija*` (including the F011 verification-notice
 * sub-route) -- the pages a signed-out visitor uses to authenticate. */
export function isLoginOrSignupPath(pathname: string): boolean {
  return LOGIN_SIGNUP_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** `/upitnik` -- the public, pre-auth onboarding questionnaire. Never gated:
 * a logged-out visitor answers it before creating an account. */
export function isQuestionnairePath(pathname: string): boolean {
  return matchesPrefix(pathname, QUESTIONNAIRE_PATH);
}

/** The `/auth/*` code-exchange callback -- never gated, and (unlike
 * `/prijava`/`/registracija`) never bounced away from once signed in either,
 * since a fully set-up user can still legitimately land here (e.g. an
 * email-change confirmation link clicked while already signed in). */
export function isAuthCallbackPath(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_CALLBACK_PREFIX);
}

/** `/onboarding` and its sub-routes -- exempt from the "not onboarded yet"
 * redirect so visiting it while not onboarded never loops back to itself. */
export function isOnboardingPath(pathname: string): boolean {
  return matchesPrefix(pathname, ONBOARDING_PATH);
}

/** `/telefon` -- the phone-capture page, exempt from the "no phone yet"
 * redirect so visiting it while phone-less never loops back to itself. */
export function isPhoneCapturePath(pathname: string): boolean {
  return matchesPrefix(pathname, PHONE_CAPTURE_PATH);
}

/**
 * Machine-to-machine endpoints: called by a scheduler, never by a person.
 *
 * These carry no session cookie and no phone User-Agent, so BOTH middleware
 * gates (phone-only, then auth) would bounce them before the handler ever ran.
 * They are let through as an exact-match allowlist — never a prefix — and each
 * one authenticates its caller itself with a shared secret, so skipping the
 * cookie-based gates costs nothing.
 *
 * Today that is only the reminder sender, driven by pg_cron every 15 minutes
 * (see `supabase/migrations/0021_push_reminders.sql`).
 */
export const MACHINE_PATHS: readonly string[] = ["/api/podsetnici/posalji"];

export function isMachinePath(pathname: string): boolean {
  return MACHINE_PATHS.includes(pathname);
}

/** Never gated regardless of auth/verification/onboarding state: the public
 * marketing landing page, the pre-auth `/upitnik` questionnaire, the
 * login/signup pages, the auth callback, the password-reset flow, and the
 * three legal documents.
 *
 * The legal documents are public in the strongest sense the app has: a store
 * reviewer opens them from the listing with no account at all, and Play
 * specifically requires the account-deletion page to work without installing
 * anything. See `src/lib/legal/paths.ts` — the phone gate exempts the same
 * three paths one layer earlier. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === MARKETING_HOME_PATH ||
    isQuestionnairePath(pathname) ||
    isLoginOrSignupPath(pathname) ||
    isAuthCallbackPath(pathname) ||
    isPasswordResetPath(pathname) ||
    isLegalPath(pathname)
  );
}

/**
 * The single source of truth for "given this request's auth state, should
 * this path be allowed through, or redirected -- and to where."
 */
export function decideRouteAccess(input: RouteProtectionInput): RouteDecision {
  const {
    pathname,
    isAuthenticated,
    isEmailVerified: verified,
    isOnboarded,
    hasPhone = true,
    isNativeShell = false,
  } = input;

  // 0. The native shell asking for `/`.
  //
  //    `capacitor.config.ts` points the web view at https://fitmess.app, so
  //    every launch of the installed app requests the site root -- which is
  //    the public marketing landing page. It renders identically for a signed
  //    -in user (it never looks at the session), so the app opened on "Započni
  //    → /upitnik" every single time and read as "it forgot my account".
  //
  //    The installed PWA never had this: `public/manifest.json` already
  //    declares `start_url: "/danas"`. The correct entry point exists; only the
  //    shell wasn't using it. So this is that same start_url, enforced one
  //    layer deeper -- where it also covers shells already on people's phones,
  //    since the fix ships with a deploy rather than a new binary.
  //
  //    It also matters for review: an App Store reviewer who launches the app
  //    and lands on a marketing page with a "Započni" button is looking at the
  //    most recognisable signature of a repackaged website there is
  //    (Guideline 4.2).
  //
  //    Answered by asking what would happen if the shell had requested
  //    `/danas` instead: if that would be allowed, send it there; if a gate
  //    would catch it (signed out, unverified, no phone, not onboarded), that
  //    gate's own redirect is the right answer here too.
  if (isNativeShell && pathname === MARKETING_HOME_PATH) {
    const asAppHome = decideRouteAccess({
      ...input,
      pathname: SIGNED_IN_HOME_PATH,
      isNativeShell: false,
    });
    return asAppHome.action === "allow"
      ? { action: "redirect", to: SIGNED_IN_HOME_PATH }
      : asAppHome;
  }

  // 1. No session at all (AS-011).
  if (!isAuthenticated) {
    if (isPublicPath(pathname)) return { action: "allow" };
    return { action: "redirect", to: SIGNED_OUT_REDIRECT_PATH };
  }

  // 2. Signed in, but the email hasn't been verified yet. Defense-in-depth:
  //    `signInEmailPassword` (F011) already refuses to leave an unconfirmed
  //    email/password account with a session, but a stale cookie or a
  //    future signup flow could still reach here. Never triggers for a
  //    Google identity -- `isEmailVerified` is provider-agnostic (F012).
  if (!verified) {
    if (isPublicPath(pathname)) return { action: "allow" };
    return { action: "redirect", to: VERIFY_EMAIL_NOTICE_PATH };
  }

  // 2.5. Verified, but the optional phone ask hasn't been answered yet. Only
  //    ever catches OAuth users (Apple, Google), who never saw the signup
  //    form's optional phone field; they get `/telefon` once -- with a
  //    "Preskoči" that ends the ask for good -- deliberately BEFORE onboarding,
  //    to stay out of the onboarding -> plan-reveal -> /danas hand-off
  //    entirely. Nothing here may become mandatory again: see the header of
  //    `@/lib/auth/phone-prompt` for the guideline that forbids it.
  if (!hasPhone) {
    if (isPhoneCapturePath(pathname)) return { action: "allow" }; // no loop
    if (isPublicPath(pathname)) return { action: "allow" };
    return { action: "redirect", to: PHONE_CAPTURE_PATH };
  }

  // 3. Verified, but onboarding isn't complete yet.
  if (!isOnboarded) {
    if (isOnboardingPath(pathname)) return { action: "allow" }; // no redirect loop
    if (isPublicPath(pathname)) return { action: "allow" };
    return { action: "redirect", to: ONBOARDING_PATH };
  }

  // 4. Fully set up: bounce away from the login/signup pages toward the
  //    app instead of showing them a login form they no longer need.
  if (isLoginOrSignupPath(pathname)) {
    return { action: "redirect", to: SIGNED_IN_HOME_PATH };
  }

  return { action: "allow" };
}
