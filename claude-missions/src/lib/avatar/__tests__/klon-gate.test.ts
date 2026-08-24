// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { isKlonRequired } from "@/lib/avatar/klon-gate";

/**
 * The switch on the only wall that stands in front of both a first-time visitor
 * and every existing account. Its whole value is being predictable at the worst
 * possible moment, so both directions are pinned.
 */
describe("isKlonRequired", () => {
  const original = process.env.KLON_OBAVEZAN;

  afterEach(() => {
    if (original === undefined) delete process.env.KLON_OBAVEZAN;
    else process.env.KLON_OBAVEZAN = original;
  });

  it("is OFF when the variable is not set at all", () => {
    // The deploy that ships this feature must not lock out every account that
    // predates it -- and none of them has a klon.
    delete process.env.KLON_OBAVEZAN;
    expect(isKlonRequired()).toBe(false);
  });

  it("enforces only on the exact string 'true'", () => {
    process.env.KLON_OBAVEZAN = "true";
    expect(isKlonRequired()).toBe(true);
  });

  it.each(["", "TRUE", "1", "yes", "da", "on", " true", "false"])(
    "stays OFF for %o -- enforcement is deliberate, never accidental",
    (value) => {
      process.env.KLON_OBAVEZAN = value;
      expect(isKlonRequired()).toBe(false);
    }
  );
});
