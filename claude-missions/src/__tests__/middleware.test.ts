import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The middleware matcher, verified against its source rather than by running
// it: `export const config` is read by the Next.js build, not by application
// code, so there is nothing to invoke — the regex string IS the behaviour.
//
// This exists because getting the matcher wrong fails silently and expensively.
// A static file that the pattern does not exclude gets a session-refresh +
// auth/onboarding redirect instead of its bytes; the browser follows the
// redirect, gets HTML where it expected media, and the asset simply never
// appears. That is exactly how the landing hero film shipped broken once.

const MIDDLEWARE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "..", "middleware.ts"),
  "utf-8"
);

/**
 * The matcher's negative-lookahead pattern. Read as raw file text, so the
 * backslashes are still TypeScript string-literal escapes (`\\.`) — collapse
 * them to get the pattern Next.js actually compiles (`\.`).
 */
const matcher = (
  MIDDLEWARE_SOURCE.match(/matcher:\s*\[\s*"([^"]+)"/)?.[1] ?? ""
).replace(/\\\\/g, "\\");

/** Would a request for `pathname` be handed to the middleware? */
function runsMiddlewareOn(pathname: string): boolean {
  return new RegExp(`^${matcher}$`).test(pathname);
}

describe("middleware matcher: static assets bypass, pages don't", () => {
  it("test_matcher_is_present_in_the_source", () => {
    expect(matcher).not.toBe("");
  });

  it("test_matcher_lets_the_landing_hero_film_through_untouched", () => {
    // The <video> in `components/landing/hero-video.tsx` fetches these two.
    expect(runsMiddlewareOn("/landing/hero.mp4")).toBe(false);
    expect(runsMiddlewareOn("/landing/hero.webm")).toBe(false);
    expect(runsMiddlewareOn("/landing/hero-poster.jpg")).toBe(false);
  });

  it("test_matcher_lets_the_other_static_assets_through_untouched", () => {
    for (const asset of [
      "/brand/fitmess-icon.png",
      "/icons/icon-512.png",
      "/landing/obrok.jpg",
      "/next.svg",
      "/manifest.json",
      "/sw.js",
      // Precached by the service worker: a gate redirect here would be cached
      // AS the offline screen.
      "/offline.html",
      "/favicon.ico",
    ]) {
      expect(runsMiddlewareOn(asset), `${asset} must bypass`).toBe(false);
    }
  });

  it("test_matcher_still_runs_on_real_navigations", () => {
    // The flip side: the auth/onboarding gate has to keep firing for pages, or
    // excluding assets would have quietly opened the app up.
    for (const route of ["/", "/danas", "/profil", "/prijava", "/api/logs"]) {
      expect(runsMiddlewareOn(route), `${route} must be guarded`).toBe(true);
    }
  });
});
