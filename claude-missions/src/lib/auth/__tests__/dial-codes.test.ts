import { describe, expect, it } from "vitest";

import { DEFAULT_DIAL_CODE, splitPhone } from "../dial-codes";
import { normalizePhone } from "../validation";

// `splitPhone` is the inverse of `normalizePhone`: it lets the "Broj telefona"
// edit form show the number already on file instead of an empty field.

describe("splitPhone", () => {
  it("test_splits_a_serbian_number_into_picker_and_local_part", () => {
    expect(splitPhone("+381600637486")).toEqual({
      dialCode: "+381",
      local: "600637486",
    });
  });

  it("test_a_longer_dial_code_wins_over_a_shorter_prefix", () => {
    // +41 (Švajcarska) must not be read as +4 something, and +1 must not steal
    // numbers that start +1... from a longer code.
    expect(splitPhone("+41791234567").dialCode).toBe("+41");
    expect(splitPhone("+15551234567").dialCode).toBe("+1");
    expect(splitPhone("+385911234567").dialCode).toBe("+385");
  });

  it("test_round_trips_with_normalizePhone", () => {
    for (const original of ["+381600637486", "+4915112345678", "+38761234567"]) {
      const { dialCode, local } = splitPhone(original);
      expect(normalizePhone(dialCode, local)).toBe(original);
    }
  });

  it("test_an_empty_profile_starts_on_the_default_country", () => {
    expect(splitPhone(null)).toEqual({ dialCode: DEFAULT_DIAL_CODE, local: "" });
    expect(splitPhone("")).toEqual({ dialCode: DEFAULT_DIAL_CODE, local: "" });
  });

  it("test_an_unknown_country_keeps_every_digit_visible", () => {
    // Better to show a number that needs fixing than to silently drop digits
    // the user would then re-save wrong.
    expect(splitPhone("+998901234567")).toEqual({
      dialCode: DEFAULT_DIAL_CODE,
      local: "998901234567",
    });
  });
});
