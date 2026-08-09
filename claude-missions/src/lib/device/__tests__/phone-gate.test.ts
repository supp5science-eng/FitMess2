import { describe, expect, it } from "vitest";

import {
  PHONE_ONLY_PATH,
  decidePhoneGate,
} from "@/lib/device/phone-gate";
import { NATIVE_UA_SUFFIX } from "@/lib/device/native";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";

const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const GOOGLEBOT_DESKTOP =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Apple runs iPhone apps on an iPad: the web view reports a Macintosh UA. */
const IPAD_SHELL = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 ${NATIVE_UA_SUFFIX}`;

const IPHONE_SHELL = `${IPHONE} ${NATIVE_UA_SUFFIX}`;

describe("decidePhoneGate", () => {
  it("lets a phone through", () => {
    expect(decidePhoneGate({ pathname: "/danas", userAgent: IPHONE })).toEqual({
      action: "allow",
    });
  });

  it("sends a desktop visitor to the gate", () => {
    expect(decidePhoneGate({ pathname: "/danas", userAgent: DESKTOP })).toEqual({
      action: "redirect",
      to: PHONE_ONLY_PATH,
    });
  });

  it("serves the gate page itself to a desktop visitor, without redirect loops", () => {
    expect(
      decidePhoneGate({ pathname: PHONE_ONLY_PATH, userAgent: DESKTOP })
    ).toEqual({ action: "serve-gate" });
  });

  it("bounces a phone off the gate URL back into the app", () => {
    expect(
      decidePhoneGate({ pathname: PHONE_ONLY_PATH, userAgent: IPHONE })
    ).toEqual({ action: "redirect", to: "/" });
  });

  it("lets desktop-shaped crawlers through, or the site cannot be indexed", () => {
    expect(
      decidePhoneGate({ pathname: "/", userAgent: GOOGLEBOT_DESKTOP })
    ).toEqual({ action: "allow" });
  });

  it("lets the native shell through even when its UA reads as a desktop Mac", () => {
    // This is the App Store review scenario: reject this request and the
    // reviewer sees "open this on your phone" instead of the app.
    expect(
      decidePhoneGate({ pathname: "/danas", userAgent: IPAD_SHELL })
    ).toEqual({ action: "allow" });
  });

  it("lets the native shell through on a phone too", () => {
    expect(
      decidePhoneGate({ pathname: "/danas", userAgent: IPHONE_SHELL })
    ).toEqual({ action: "allow" });
  });

  it("treats a missing User-Agent as not-a-phone", () => {
    expect(decidePhoneGate({ pathname: "/danas", userAgent: null })).toEqual({
      action: "redirect",
      to: PHONE_ONLY_PATH,
    });
  });
});
