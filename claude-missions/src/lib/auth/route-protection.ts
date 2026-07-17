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
/** Where a fully set-up visitor landing on an auth page is bounced to. */
export const SIGNED_IN_HOME_PATH = "/danas";

const LOGIN_SIGNUP_PREFIXES = ["/prijava", "/registracija"];
const AUTH_CALLBACK_PREFIX = "/auth";
const MARKETING_HOME_PATH = "/";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** `/prijava` and `/registracija*` (including the F011 verification-notice
 * sub-route) -- the pages a signed-out visitor uses to authenticate. */
export function isLoginOrSignupPath(pathname: string): boolean {
  return LOGIN_SIGNUP_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
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

/** Never gated regardless of auth/verification/onboarding state: the public
 * marketing landing page, the login/signup pages, and the auth callback. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === MARKETING_HOME_PATH ||
    isLoginOrSignupPath(pathname) ||
    isAuthCallbackPath(pathname)
  );
}

/**
 * The single source of truth for "given this request's auth state, should
 * this path be allowed through, or redirected -- and to where."
 */
export function decideRouteAccess(input: RouteProtectionInput): RouteDecision {
  const { pathname, isAuthenticated, isEmailVerified: verified, isOnboarded } =
    input;

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
