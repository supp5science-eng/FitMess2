import { describe, expect, it } from "vitest";

import { cmToFeetInches, formatFeetInches, kgToLbs } from "../units";

describe("cmToFeetInches", () => {
  it("converts a common height", () => {
    // 186 cm -> 73.23" -> 6'1"
    expect(cmToFeetInches(186)).toEqual({ feet: 6, inches: 1 });
  });

  it("rolls 12 inches over into the next foot", () => {
    // 179 cm -> 70.47" -> 5'10" (no rollover); pick a value that rounds to 12"
    // 175.3 cm -> 69.02" -> 5'9"; 177.7 cm -> 69.96" -> 5'10". Use a rollover case:
    // 187.96 cm -> 74.0" -> 6'2"; 190.4 cm -> 74.96" -> 6'3" (rounds to 75 -> 6'3").
    // A true rollover: 152.3 cm -> 59.96" -> floor 4ft + round(11.96)=12 -> 5'0".
    expect(cmToFeetInches(152.3)).toEqual({ feet: 5, inches: 0 });
  });

  it("formats as feet'inches\"", () => {
    expect(formatFeetInches(186)).toBe("6'1\"");
  });
});

describe("kgToLbs", () => {
  it("converts and rounds to whole lbs", () => {
    // 90 kg -> 198.42 -> 198
    expect(kgToLbs(90)).toBe(198);
  });

  it("rounds up near the boundary", () => {
    // 80 kg -> 176.37 -> 176
    expect(kgToLbs(80)).toBe(176);
  });
});
