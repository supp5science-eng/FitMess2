import { describe, expect, it } from "vitest";

import {
  NATIVE_UA_SUFFIX,
  isNativeAppUserAgent,
} from "@/lib/device/native";
import { isMobileUserAgent } from "@/lib/device/is-mobile";

/** A real iPhone Safari UA with the shell's marker appended, exactly as
 * Capacitor's `appendUserAgent` produces it. */
const IPHONE_SHELL = `Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${NATIVE_UA_SUFFIX}`;

/** The case that decides an App Store review: Apple runs iPhone apps on an
 * iPad, whose web view reports a Macintosh UA with no mobile token at all. */
const IPAD_SHELL = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 ${NATIVE_UA_SUFFIX}`;

const ANDROID_SHELL = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 ${NATIVE_UA_SUFFIX}`;

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";

const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

describe("isNativeAppUserAgent", () => {
  it("recognises the shell on iPhone", () => {
    expect(isNativeAppUserAgent(IPHONE_SHELL)).toBe(true);
  });

  it("recognises the shell on Android", () => {
    expect(isNativeAppUserAgent(ANDROID_SHELL)).toBe(true);
  });

  it("recognises the shell on iPad, where the UA looks like a desktop Mac", () => {
    expect(isNativeAppUserAgent(IPAD_SHELL)).toBe(true);
    // The point of the whole exemption: this UA does NOT read as a phone, so
    // without the native check the App Store reviewer gets the desktop gate.
    expect(isMobileUserAgent(IPAD_SHELL)).toBe(false);
  });

  it("does not fire for ordinary browsers", () => {
    expect(isNativeAppUserAgent(IPHONE_SAFARI)).toBe(false);
    expect(isNativeAppUserAgent(DESKTOP_CHROME)).toBe(false);
  });

  it("tolerates a missing User-Agent", () => {
    expect(isNativeAppUserAgent(null)).toBe(false);
    expect(isNativeAppUserAgent(undefined)).toBe(false);
    expect(isNativeAppUserAgent("")).toBe(false);
  });

  it("matches any shell version, not just the one this build ships", () => {
    // A user on an older shell must not be treated as a browser: they would be
    // shown install walkthroughs for an app they already installed.
    expect(
      isNativeAppUserAgent(`${IPHONE_SAFARI} FitMessApp/0.9`)
    ).toBe(true);
    expect(
      isNativeAppUserAgent(`${IPHONE_SAFARI} FitMessApp/2.4.1`)
    ).toBe(true);
  });
});
