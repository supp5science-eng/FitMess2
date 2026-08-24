// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashRequestIp } from "@/lib/avatar/klon-ip-cap";

/**
 * The public klon endpoint's only identifier. Two properties matter, and both
 * are the kind that fail silently: a hash that leaks the address, and a header
 * the caller can forge to mint a fresh identity per request.
 */
describe("hashRequestIp", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("never returns the address itself", () => {
    const hash = hashRequestIp(headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(hash).not.toBeNull();
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the same address the same counter", () => {
    expect(hashRequestIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      hashRequestIp(headers({ "x-forwarded-for": "203.0.113.7" }))
    );
  });

  it("gives different addresses different counters", () => {
    expect(hashRequestIp(headers({ "x-forwarded-for": "203.0.113.7" }))).not.toBe(
      hashRequestIp(headers({ "x-forwarded-for": "203.0.113.8" }))
    );
  });

  it("counts the LAST forwarded entry, not the first", () => {
    // The client controls the front of `x-forwarded-for`; the proxy appends the
    // real peer at the end. Trusting `[0]` would let one header give every
    // request a fresh identity and make the cap decorative.
    const forged = hashRequestIp(
      headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" })
    );
    const direct = hashRequestIp(headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(forged).toBe(direct);
  });

  it("falls back to x-real-ip when there is no forwarded chain", () => {
    expect(hashRequestIp(headers({ "x-real-ip": "203.0.113.9" }))).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  it("returns null when there is no address at all", () => {
    // The caller treats this as "cannot count" and fails OPEN -- a broken
    // counter must not become a wall in front of the first screen.
    expect(hashRequestIp(headers({}))).toBeNull();
  });
});
