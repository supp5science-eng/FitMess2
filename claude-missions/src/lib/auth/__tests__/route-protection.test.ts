import { describe, expect, it } from "vitest";

import {
  ONBOARDING_PATH,
  SIGNED_IN_HOME_PATH,
  SIGNED_OUT_REDIRECT_PATH,
  VERIFY_EMAIL_NOTICE_PATH,
  decideRouteAccess,
  isAuthCallbackPath,
  isLoginOrSignupPath,
  isOnboardingPath,
  isPublicPath,
} from "@/lib/auth/route-protection";

// F013: unit coverage for the pure redirect-decision function that backs
// `src/middleware.ts` (AS-011, AS-012). Deliberately framework-free -- no
// `NextRequest`/`NextResponse`, no live Supabase project -- so every branch
// of the redirect matrix is covered fast and in isolation. The
// request-level proof against a real running middleware + a real Supabase
// project lives in
// `src/app/(app)/__tests__/route-protection.integration.test.ts`.

const PROTECTED_PATHS = ["/danas", "/nedelja", "/agent", "/profil", "/dodaj/obrok"];

describe("AS-011: a signed-out visitor requesting any in-app page is redirected to the login screen", () => {
  it.each(PROTECTED_PATHS)(
    "test_AS_011_signed_out_visitor_requesting_%s_is_redirected_to_prijava",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: false,
        isEmailVerified: false,
        isOnboarded: false,
      });

      expect(decision).toEqual({
        action: "redirect",
        to: SIGNED_OUT_REDIRECT_PATH,
      });
    }
  );

  it("test_AS_011_signed_out_visitor_requesting_the_onboarding_route_is_also_redirected_to_prijava", () => {
    const decision = decideRouteAccess({
      pathname: "/onboarding",
      isAuthenticated: false,
      isEmailVerified: false,
      isOnboarded: false,
    });

    expect(decision).toEqual({ action: "redirect", to: SIGNED_OUT_REDIRECT_PATH });
  });

  it.each(["/", "/prijava", "/registracija", "/registracija/proveri-email", "/auth/callback"])(
    "test_AS_011_signed_out_visitor_requesting_the_public_path_%s_is_allowed_through",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: false,
        isEmailVerified: false,
        isOnboarded: false,
      });

      expect(decision).toEqual({ action: "allow" });
    }
  );
});

describe("AS-012: a signed-in user can sign out; afterwards protected pages redirect to login", () => {
  it.each(PROTECTED_PATHS)(
    "test_AS_012_after_sign_out_a_request_to_%s_redirects_to_prijava_just_like_a_never_signed_in_visitor",
    (pathname) => {
      // Modelled as the exact same "no session" input a request carries
      // once `signOutAction` has cleared the cookie -- this is the
      // observable behaviour AS-012 describes ("afterwards protected pages
      // redirect to login"), proven here at the decision-function level;
      // the live-cookie proof lives in the integration test.
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: false,
        isEmailVerified: false,
        isOnboarded: false,
      });

      expect(decision).toEqual({ action: "redirect", to: SIGNED_OUT_REDIRECT_PATH });
    }
  );

  it("test_AS_012_after_sign_out_the_login_page_itself_is_reachable_again", () => {
    // Before sign-out a fully set-up user is bounced away from /prijava
    // (see the "bounce away from auth pages" test below); after sign-out
    // that page must become reachable again, not stuck redirecting
    // somewhere else.
    const decision = decideRouteAccess({
      pathname: "/prijava",
      isAuthenticated: false,
      isEmailVerified: false,
      isOnboarded: false,
    });

    expect(decision).toEqual({ action: "allow" });
  });
});

describe("unverified email/password users are routed to the F011 verification notice, never blocked from public pages", () => {
  it.each(PROTECTED_PATHS)(
    "test_unverified_user_requesting_%s_is_redirected_to_the_verification_notice",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: true,
        isEmailVerified: false,
        isOnboarded: false,
      });

      expect(decision).toEqual({
        action: "redirect",
        to: VERIFY_EMAIL_NOTICE_PATH,
      });
    }
  );

  it("test_unverified_user_can_still_reach_the_login_and_signup_pages", () => {
    for (const pathname of ["/prijava", "/registracija", "/registracija/proveri-email"]) {
      expect(
        decideRouteAccess({
          pathname,
          isAuthenticated: true,
          isEmailVerified: false,
          isOnboarded: false,
        })
      ).toEqual({ action: "allow" });
    }
  });

  it("test_a_google_authenticated_verified_identity_is_never_routed_to_the_verification_notice", () => {
    // F012's isEmailVerified() is provider-agnostic (keys on
    // email_confirmed_at, not app_metadata.provider) -- from this pure
    // function's point of view a Google identity is simply
    // isEmailVerified: true, and must never hit the unverified branch.
    const decision = decideRouteAccess({
      pathname: "/danas",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: true,
    });

    expect(decision).toEqual({ action: "allow" });
  });
});

describe("verified-but-not-onboarded users are routed to /onboarding, with no redirect loop", () => {
  it.each(PROTECTED_PATHS)(
    "test_verified_not_onboarded_user_requesting_%s_is_redirected_to_onboarding",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: false,
      });

      expect(decision).toEqual({ action: "redirect", to: ONBOARDING_PATH });
    }
  );

  it("test_verified_not_onboarded_user_requesting_the_onboarding_route_itself_is_allowed_no_loop", () => {
    const decision = decideRouteAccess({
      pathname: "/onboarding",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
    });

    expect(decision).toEqual({ action: "allow" });
  });

  it("test_verified_not_onboarded_user_requesting_an_onboarding_sub_route_is_allowed_no_loop", () => {
    const decision = decideRouteAccess({
      pathname: "/onboarding/korak-2",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
    });

    expect(decision).toEqual({ action: "allow" });
  });
});

describe("fully set-up users (verified + onboarded) are bounced away from the login/signup pages", () => {
  it.each(["/prijava", "/registracija", "/registracija/proveri-email"])(
    "test_fully_set_up_user_hitting_%s_is_redirected_to_the_home_screen",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: true,
      });

      expect(decision).toEqual({ action: "redirect", to: SIGNED_IN_HOME_PATH });
    }
  );

  it("test_fully_set_up_user_hitting_the_auth_callback_route_is_not_bounced_away", () => {
    // Unlike /prijava and /registracija, /auth/* (the code-exchange
    // callback) must stay reachable even for an already fully set-up user
    // -- e.g. an email-change confirmation link clicked while already
    // signed in on another tab.
    const decision = decideRouteAccess({
      pathname: "/auth/callback",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: true,
    });

    expect(decision).toEqual({ action: "allow" });
  });

  it.each(PROTECTED_PATHS)(
    "test_fully_set_up_user_requesting_%s_is_allowed_through",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: true,
      });

      expect(decision).toEqual({ action: "allow" });
    }
  );
});

describe("path classifier helpers", () => {
  it("test_isPublicPath_covers_marketing_home_login_signup_and_auth_callback", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/prijava")).toBe(true);
    expect(isPublicPath("/registracija")).toBe(true);
    expect(isPublicPath("/registracija/proveri-email")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/danas")).toBe(false);
    expect(isPublicPath("/profil")).toBe(false);
  });

  it("test_isLoginOrSignupPath_excludes_the_auth_callback_route", () => {
    expect(isLoginOrSignupPath("/prijava")).toBe(true);
    expect(isLoginOrSignupPath("/registracija")).toBe(true);
    expect(isLoginOrSignupPath("/auth/callback")).toBe(false);
  });

  it("test_isAuthCallbackPath_matches_only_the_auth_prefix", () => {
    expect(isAuthCallbackPath("/auth/callback")).toBe(true);
    expect(isAuthCallbackPath("/auth")).toBe(true);
    expect(isAuthCallbackPath("/authorization")).toBe(false);
  });

  it("test_isOnboardingPath_matches_the_onboarding_prefix_only", () => {
    expect(isOnboardingPath("/onboarding")).toBe(true);
    expect(isOnboardingPath("/onboarding/korak-1")).toBe(true);
    expect(isOnboardingPath("/onboardingfoo")).toBe(false);
  });
});
