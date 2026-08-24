// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { isKlonRequired } from "@/lib/avatar/klon-gate";

/**
 * The emergency switch on the only wall that stands in front of a first-time
 * visitor. Its whole value is being predictable at the worst possible moment,
 * so both directions are pinned.
 */
describe("isKlonRequired", () => {
  const original = process.env.KLON_OBAVEZAN;

  afterEach(() => {
    if (original === undefined) delete process.env.KLON_OBAVEZAN;
    else process.env.KLON_OBAVEZAN = original;
  });

  it("is ON when the variable is not set at all", () => {
    delete process.env.KLON_OBAVEZAN;
    expect(isKlonRequired()).toBe(true);
  });

  it("opens the gate only for the exact string 'false'", () => {
    process.env.KLON_OBAVEZAN = "false";
    expect(isKlonRequired()).toBe(false);
  });

  it.each(["", "FALSE", "0", "no", "ne", "off", " false"])(
    "stays ON for %o -- a typo must not quietly undo the product decision",
    (value) => {
      process.env.KLON_OBAVEZAN = value;
      expect(isKlonRequired()).toBe(true);
    }
  );
});
