import { describe, expect, it } from "vitest";

import {
  hasClearedPhonePrompt,
  PHONE_PROMPT_COOKIE,
} from "@/lib/auth/phone-prompt";

/**
 * The `/telefon` ask is the screen App Store guideline 5.1.1(v) turns into a
 * rejection the moment it becomes a wall again. These tests pin the two
 * properties that keep it an ask:
 *
 *  1. Nobody is ever stuck on it — a "Preskoči" answer clears it for good.
 *  2. It is still shown once to the users it has something to ask.
 *
 * The user id is the cookie's value, not `"1"`, so a phone shared between two
 * accounts can't leak one person's answer into the other's session.
 */

const USER = "8ac1f6c2-0000-4000-8000-000000000001";
const OTHER_USER = "8ac1f6c2-0000-4000-8000-000000000002";

describe("hasClearedPhonePrompt", () => {
  it("test_email_password_users_are_never_asked_here", () => {
    // They were already offered the (optional) field on the signup form.
    expect(
      hasClearedPhonePrompt({
        provider: "email",
        phone: null,
        promptCookie: null,
        userId: USER,
      })
    ).toBe(true);
  });

  it("test_a_missing_provider_never_walls_anyone_out", () => {
    // Defensive: an unreadable `app_metadata.provider` must fail OPEN. Failing
    // closed here would put every affected user on a screen they cannot leave.
    expect(
      hasClearedPhonePrompt({
        provider: null,
        phone: null,
        promptCookie: null,
        userId: USER,
      })
    ).toBe(true);
  });

  it("test_an_oauth_user_with_no_phone_and_no_answer_is_asked_once", () => {
    for (const provider of ["apple", "google"]) {
      expect(
        hasClearedPhonePrompt({
          provider,
          phone: null,
          promptCookie: null,
          userId: USER,
        })
      ).toBe(false);
    }
  });

  it("test_an_oauth_user_who_skipped_is_never_asked_again", () => {
    for (const provider of ["apple", "google"]) {
      expect(
        hasClearedPhonePrompt({
          provider,
          phone: null,
          promptCookie: USER,
          userId: USER,
        })
      ).toBe(true);
    }
  });

  it("test_an_oauth_user_who_gave_a_number_is_not_asked_again", () => {
    expect(
      hasClearedPhonePrompt({
        provider: "apple",
        phone: "+381600637486",
        promptCookie: null,
        userId: USER,
      })
    ).toBe(true);
  });

  it("test_another_users_answer_does_not_count", () => {
    expect(
      hasClearedPhonePrompt({
        provider: "google",
        phone: null,
        promptCookie: OTHER_USER,
        userId: USER,
      })
    ).toBe(false);
  });

  it("test_a_truthy_but_wrong_cookie_value_does_not_count", () => {
    // An older "just set it to 1" cookie shape, or a hand-edited one.
    expect(
      hasClearedPhonePrompt({
        provider: "google",
        phone: null,
        promptCookie: "1",
        userId: USER,
      })
    ).toBe(false);
  });

  it("test_apple_hide_my_email_addresses_are_ordinary_accounts", () => {
    // The whole reason the ask had to become skippable: a Sign in with Apple
    // user who hid their email must not be met with "then give us your phone".
    expect(
      hasClearedPhonePrompt({
        provider: "apple",
        phone: null,
        promptCookie: USER,
        userId: USER,
      })
    ).toBe(true);
  });

  it("test_the_cookie_name_is_stable", () => {
    // Renaming it silently re-asks every user who already answered.
    expect(PHONE_PROMPT_COOKIE).toBe("fm_tel");
  });
});
