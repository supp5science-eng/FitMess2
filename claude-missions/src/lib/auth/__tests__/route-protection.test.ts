import { describe, expect, it } from "vitest";

import {
  ONBOARDING_PATH,
  PHONE_CAPTURE_PATH,
  SIGNED_IN_HOME_PATH,
  SIGNED_OUT_REDIRECT_PATH,
  VERIFY_EMAIL_NOTICE_PATH,
  decideRouteAccess,
  isAuthCallbackPath,
  isLoginOrSignupPath,
  isOnboardingPath,
  isPasswordResetPath,
  isPhoneCapturePath,
  isPublicPath,
  isMachinePath,
} from "@/lib/auth/route-protection";

// F013: unit coverage for the pure redirect-decision function that backs
// `src/middleware.ts` (AS-011, AS-012). Deliberately framework-free -- no
// `NextRequest`/`NextResponse`, no live Supabase project -- so every branch
// of the redirect matrix is covered fast and in isolation. The
// request-level proof against a real running middleware + a real Supabase
// project lives in
// `src/app/(app)/__tests__/route-protection.integration.test.ts`.

const PROTECTED_PATHS = ["/danas", "/analitika", "/profil", "/dodaj/obrok"];

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

  it.each(["/", "/upitnik", "/prijava", "/registracija", "/registracija/proveri-email", "/auth/callback"])(
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

  it.each(["/zaboravljena-lozinka", "/nova-lozinka"])(
    "test_signed_out_visitor_requesting_the_password_reset_path_%s_is_allowed_through",
    (pathname) => {
      // A user who forgot their password is by definition signed out; the
      // forgot-password request page must stay reachable for them.
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

  it("test_recovery_session_user_reaching_nova_lozinka_before_onboarding_is_not_bounced_to_onboarding", () => {
    // The recovery link establishes a real (verified) session, but a user who
    // signed up long ago may never have finished onboarding. `/nova-lozinka`
    // must stay reachable so they can actually set the new password instead of
    // being redirect-looped to /onboarding first.
    const decision = decideRouteAccess({
      pathname: "/nova-lozinka",
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

describe("verified users with no phone on file are routed to /telefon once (Google OAuth)", () => {
  it.each(PROTECTED_PATHS)(
    "test_verified_phoneless_user_requesting_%s_is_redirected_to_telefon",
    (pathname) => {
      const decision = decideRouteAccess({
        pathname,
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: false,
        hasPhone: false,
      });

      expect(decision).toEqual({ action: "redirect", to: PHONE_CAPTURE_PATH });
    }
  );

  it("test_phoneless_user_on_the_telefon_page_itself_is_allowed_no_loop", () => {
    const decision = decideRouteAccess({
      pathname: "/telefon",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
      hasPhone: false,
    });

    expect(decision).toEqual({ action: "allow" });
  });

  it("test_phone_gate_takes_precedence_over_onboarding", () => {
    // A phone-less, not-yet-onboarded user visiting /onboarding must be sent to
    // /telefon first -- phone is captured before onboarding, on purpose.
    const decision = decideRouteAccess({
      pathname: "/onboarding",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
      hasPhone: false,
    });

    expect(decision).toEqual({ action: "redirect", to: PHONE_CAPTURE_PATH });
  });

  it("test_phoneless_user_can_still_reach_public_paths", () => {
    const decision = decideRouteAccess({
      pathname: "/auth/callback",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
      hasPhone: false,
    });

    expect(decision).toEqual({ action: "allow" });
  });

  it("test_user_with_a_phone_skips_the_gate_and_proceeds_to_onboarding", () => {
    const decision = decideRouteAccess({
      pathname: "/danas",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: false,
      hasPhone: true,
    });

    expect(decision).toEqual({ action: "redirect", to: ONBOARDING_PATH });
  });

  it("test_hasPhone_defaults_to_true_so_a_caller_that_omits_it_never_trips_the_gate", () => {
    const decision = decideRouteAccess({
      pathname: "/danas",
      isAuthenticated: true,
      isEmailVerified: true,
      isOnboarded: true,
    });

    expect(decision).toEqual({ action: "allow" });
  });
});

describe("path classifier helpers", () => {
  it("test_isPublicPath_covers_marketing_home_login_signup_auth_callback_and_password_reset", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/upitnik")).toBe(true);
    expect(isPublicPath("/upitnik/bilo-sta")).toBe(true);
    expect(isPublicPath("/prijava")).toBe(true);
    expect(isPublicPath("/registracija")).toBe(true);
    expect(isPublicPath("/registracija/proveri-email")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/zaboravljena-lozinka")).toBe(true);
    expect(isPublicPath("/nova-lozinka")).toBe(true);
    expect(isPublicPath("/danas")).toBe(false);
    expect(isPublicPath("/profil")).toBe(false);
  });

  it("test_isPasswordResetPath_matches_only_the_recovery_pages", () => {
    expect(isPasswordResetPath("/zaboravljena-lozinka")).toBe(true);
    expect(isPasswordResetPath("/nova-lozinka")).toBe(true);
    expect(isPasswordResetPath("/prijava")).toBe(false);
    expect(isPasswordResetPath("/nova-lozinkaX")).toBe(false);
  });

  it("test_password_reset_paths_are_not_treated_as_login_or_signup_pages", () => {
    // They must NOT be login/signup paths -- otherwise a fully set-up signed-in
    // user (e.g. a recovery session) would be bounced away from /nova-lozinka
    // before setting the new password.
    expect(isLoginOrSignupPath("/zaboravljena-lozinka")).toBe(false);
    expect(isLoginOrSignupPath("/nova-lozinka")).toBe(false);
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

  it("test_isPhoneCapturePath_matches_the_telefon_prefix_only", () => {
    expect(isPhoneCapturePath("/telefon")).toBe(true);
    expect(isPhoneCapturePath("/telefon/x")).toBe(true);
    expect(isPhoneCapturePath("/telefonx")).toBe(false);
    expect(isPhoneCapturePath("/prijava")).toBe(false);
  });
});

describe("machine-to-machine paths", () => {
  it("lets the reminder scheduler's endpoint through both gates", () => {
    // It has no session and no phone User-Agent; the route itself checks a
    // shared secret. An exact match only -- a prefix would open every future
    // /api/podsetnici/* route by accident.
    expect(isMachinePath("/api/podsetnici/posalji")).toBe(true);
    expect(isMachinePath("/api/podsetnici/posalji/nesto")).toBe(false);
    expect(isMachinePath("/api/podsetnici/proba")).toBe(false);
    expect(isMachinePath("/api/podsetnici/pretplata")).toBe(false);
    expect(isMachinePath("/danas")).toBe(false);
  });
});

describe("the native shell never opens on the marketing landing page", () => {
  // `capacitor.config.ts` points the web view at the site root, so every app
  // launch requests `/`. In a browser that is the public marketing page and
  // must stay so; inside the shell it has to behave like the PWA's
  // `start_url: "/danas"` -- otherwise a signed-in user is greeted by
  // "Započni → /upitnik" on every launch and reads it as a lost session.
  const NATIVE = { isNativeShell: true } as const;

  it("test_native_shell_requesting_the_root_lands_a_fully_set_up_user_on_the_app_home", () => {
    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/",
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: true,
      })
    ).toEqual({ action: "redirect", to: SIGNED_IN_HOME_PATH });
  });

  it("test_native_shell_requesting_the_root_sends_a_signed_out_user_to_the_login_screen", () => {
    // Not the questionnaire: a fresh install with no account still has a way
    // in, because /prijava links to /registracija.
    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/",
        isAuthenticated: false,
        isEmailVerified: false,
        isOnboarded: false,
      })
    ).toEqual({ action: "redirect", to: SIGNED_OUT_REDIRECT_PATH });
  });

  it("test_native_shell_requesting_the_root_sends_a_half_finished_signup_back_to_onboarding", () => {
    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/",
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: false,
      })
    ).toEqual({ action: "redirect", to: ONBOARDING_PATH });
  });

  it("test_native_shell_requesting_the_root_still_honours_the_phone_capture_gate", () => {
    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/",
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: true,
        hasPhone: false,
      })
    ).toEqual({ action: "redirect", to: PHONE_CAPTURE_PATH });
  });

  it("test_a_browser_visitor_still_gets_the_marketing_landing_page", () => {
    // The whole point of the flag: `/` is unchanged for everyone else --
    // signed in, signed out, and the crawlers the landing page exists for.
    for (const isAuthenticated of [true, false]) {
      expect(
        decideRouteAccess({
          pathname: "/",
          isAuthenticated,
          isEmailVerified: isAuthenticated,
          isOnboarded: isAuthenticated,
        })
      ).toEqual({ action: "allow" });
    }
  });

  it("test_the_native_shell_changes_nothing_for_any_path_other_than_the_root", () => {
    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/upitnik",
        isAuthenticated: false,
        isEmailVerified: false,
        isOnboarded: false,
      })
    ).toEqual({ action: "allow" });

    expect(
      decideRouteAccess({
        ...NATIVE,
        pathname: "/danas",
        isAuthenticated: true,
        isEmailVerified: true,
        isOnboarded: true,
      })
    ).toEqual({ action: "allow" });
  });
});
