import { NextResponse, type NextRequest } from "next/server";

import { isCrawlerPath } from "@/lib/device/is-crawler";
import { decidePhoneGate } from "@/lib/device/phone-gate";
import { isNativeAppUserAgent } from "@/lib/device/native";
import { isKlonRequired } from "@/lib/avatar/klon-gate";
import { hasClearedPhonePrompt, PHONE_PROMPT_COOKIE } from "@/lib/auth/phone-prompt";
import {
  decideRouteAccess,
  isMachinePath,
  VERIFY_EMAIL_NOTICE_PATH,
} from "@/lib/auth/route-protection";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Cookie that caches "this user has cleared both onboarding and the phone ask."
 * Both are one-way states for gate purposes (a user never un-onboards, and an
 * answered phone ask is never re-asked -- deleting the number later from
 * `/profil/telefon` does not put the ask back), so once set we can skip the
 * per-navigation `profiles` round trip entirely. The value is the user id, so the cache is only trusted for
 * the exact user it was issued to -- a different (or re-registered) account
 * won't match and falls back to a fresh DB check.
 */
const GATE_COOKIE = "fm_gate";
/** ~400 days -- the upper bound browsers honour for a persistent cookie. */
const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * F013: the app-wide route-protection boundary (AS-011, AS-012).
 *
 * Refreshes the session cookie via `updateSession` (must run on every
 * request that isn't excluded by `config.matcher` -- skipping it can cause
 * random sign-outs, per the Supabase SSR docs), resolves the current user's
 * verification + onboarding state, and delegates the actual allow/redirect
 * decision to the framework-free `decideRouteAccess` in
 * `@/lib/auth/route-protection` (unit-tested in isolation there).
 *
 * This is the enforcement point -- "This feature IS the auth/access
 * boundary; enforced server-side" per the clarified spec. Nothing here
 * trusts a locally-decoded JWT: `updateSession` resolves `user` via
 * `auth.getUser()`, which re-validates against Supabase Auth's servers.
 */
export async function middleware(request: NextRequest) {
  // Machine-to-machine endpoints first: the scheduler that sends reminders has
  // no session and no phone User-Agent, so both gates below would bounce it
  // before its handler could check its own shared secret. Exact-match
  // allowlist -- see `isMachinePath`.
  if (isMachinePath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Token-authenticated API calls: the native app (React Native, not the
  // Capacitor shell) has no cookie jar and no browser User-Agent -- its
  // `fetch` goes out as `okhttp/...` on Android and `CFNetwork/...` on iOS.
  // Both gates below would therefore bounce it: the phone gate 307s it to
  // `/samo-za-telefon` because that UA is not a phone browser, and the auth
  // gate redirects it to `/prijava` because there is no session cookie. A
  // redirect answering a `fetch` is the quiet kind of failure -- the app sees
  // an HTML page where it expected JSON, with nothing in any log naming the
  // middleware. Same trap that once 307-ed `robots.txt` and `offline.html`.
  //
  // Narrow on purpose: `/api/*` AND a bearer token. These handlers verify that
  // token themselves (`getCurrentUserId` over `createClientFromRequest`) and
  // Postgres RLS scopes every row to its owner, so the cookie-shaped gates
  // have nothing to add. A bearer header on a PAGE route is deliberately not
  // covered -- pages are for browsers, and a forged header must not get one
  // rendered without a session.
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")
  ) {
    return NextResponse.next();
  }

  // `/robots.txt` and `/sitemap.xml` must be reachable by every client. They
  // are generated pages (not static assets), so the matcher below does not
  // exclude them and the phone gate was 307-ing them to `/samo-za-telefon` --
  // which is why fitmess.app never showed up in Google. Serve them raw, with
  // no gate and no session work.
  if (isCrawlerPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Phone-only gate (runs before any auth/session work), so a desktop visit
  // never triggers the app's data fetching. Who is exempt, and why, lives with
  // the decision itself in `@/lib/device/phone-gate` -- including the native
  // shell, whose UA reads as a desktop Mac when Apple reviews the iPhone app on
  // an iPad.
  const userAgent = request.headers.get("user-agent");
  const gate = decidePhoneGate({
    pathname: request.nextUrl.pathname,
    userAgent,
  });

  if (gate.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = gate.to;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (gate.action === "serve-gate") {
    // Desktop viewing the gate itself: serve it directly, no session refresh.
    return NextResponse.next();
  }

  const { response, claims, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const authenticated = Boolean(claims);
  // The project requires email confirmation, so Supabase never issues a
  // session to an unverified account (proven by the route-protection
  // integration test: an unverified user "has no session at all"). A present,
  // locally-verified token therefore implies a verified email -- which lets us
  // avoid `getUser()`'s network call while keeping the exact same access
  // decisions.
  const verified = authenticated;

  // Only spend a DB round trip on the profile checks once we already know the
  // user is authenticated + verified -- an anonymous or unverified visitor is
  // redirected before onboarding/phone status is ever relevant.
  let onboarded = false;
  // "The phone ask has nothing left to do", NOT "this user has a phone number".
  // The two stopped being the same question when the number became optional.
  let phonePromptCleared = true;
  // Whether the avatar klon has been drawn. Starts true so that the paths that
  // never reach the profiles lookup (anonymous, unverified) are unaffected --
  // the gate below only ever runs for a verified, onboarded user anyway.
  let hasKlon = true;
  if (verified && claims) {
    // Fast path: if the gate cookie was issued to THIS user, both gates are
    // already permanently cleared -- skip the `profiles` round trip entirely.
    const gateHit = request.cookies.get(GATE_COOKIE)?.value === claims.sub;
    if (gateHit) {
      onboarded = true;
      phonePromptCleared = true;
      hasKlon = true;
    } else {
      // One query fetches the onboarding marker, the phone, and the klon
      // marker. `klon_at` is denormalized onto `profiles` for exactly this
      // reason (0034): the klon gate runs on every navigation and must not
      // make this query join a table whose rows carry a base64 PNG.
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at, phone, klon_at")
        .eq("user_id", claims.sub)
        .maybeSingle();
      onboarded = Boolean(data?.onboarded_at);
      hasKlon = Boolean(data?.klon_at);
      // Only OAuth users (Apple, Google) are shown the /telefon ask at all:
      // they never saw the signup form's optional phone field. The number is
      // NOT required -- see `@/lib/auth/phone-prompt` for why guideline
      // 5.1.1(v) and Apple's Hide My Email leave no room for it to be -- so
      // "cleared" also covers a user who tapped "Preskoči" on this device.
      phonePromptCleared = hasClearedPhonePrompt({
        provider: claims.provider,
        phone: data?.phone,
        promptCookie: request.cookies.get(PHONE_PROMPT_COOKIE)?.value,
        userId: claims.sub,
      });

      // Cache the cleared-gates state so subsequent navigations take the fast
      // path above. Bound to the user id; only set once EVERY gate passes --
      // the cookie asserts all three at once, so a user without a klon must
      // not get one or the fast path would wave them straight through.
      if (onboarded && phonePromptCleared && hasKlon) {
        response.cookies.set(GATE_COOKIE, claims.sub, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: GATE_COOKIE_MAX_AGE,
        });
      }
    }
  }

  const decision = decideRouteAccess({
    pathname,
    isAuthenticated: authenticated,
    isEmailVerified: verified,
    isOnboarded: onboarded,
    hasPhone: phonePromptCleared,
    // The switch is read HERE rather than inside `decideRouteAccess`, which
    // stays a pure function of its inputs -- that is what makes its redirect
    // matrix testable without an environment. Off => the gate is told everyone
    // already has a klon, which is exactly what "stop redirecting" means.
    hasKlon: isKlonRequired() ? hasKlon : true,
    // Only ever changes the answer for `/`: the shell's start URL is the site
    // root, and a store app must not open on the marketing landing page.
    isNativeShell: isNativeAppUserAgent(userAgent),
  });

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    // Prefill the resend-confirmation form with the signed-in-but-unverified
    // user's own email -- a convenience, not a security decision (the value
    // only ever comes from the already-authenticated session, never from
    // request input).
    if (decision.to === VERIFY_EMAIL_NOTICE_PATH && claims?.email) {
      url.searchParams.set("email", claims.email);
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excludes Next.js internals, the favicon, the PWA manifest, and common
  // static-asset extensions so the session-refresh + auth/onboarding lookup
  // above only runs for actual page/route navigations, per the clarified
  // spec's "keep the middleware matcher efficient" instruction. Pattern
  // follows Supabase's own Next.js SSR guide
  // (https://supabase.com/docs/guides/auth/server-side/nextjs).
  // `mp4|webm` are load-bearing for the landing hero film: without them the
  // middleware answers `/landing/hero.mp4` with a redirect, the <video> never
  // gets any bytes, and the hero silently degrades to its poster.
  // `offline.html` for the same reason one step further along: the service
  // worker PRECACHES it, and a precache fetch happens under whatever User-Agent
  // the browser has. On a desktop the phone gate would answer with a 307 to
  // `/samo-za-telefon`, and `cache.addAll` would happily store that page under
  // the offline URL -- so the one screen meant to say "no connection" would
  // instead say "open this on your phone". Same trap that once 307-ed
  // `robots.txt` (see `isCrawlerPath`).
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)",
  ],
};
