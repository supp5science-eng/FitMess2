import { describe, expect, it } from "vitest";

import { analyticsDayLabel } from "@/lib/analytics/day-label";

// Belgrade is UTC+2 in July, so a midday-UTC "now" is unambiguously that day.
const NOW = new Date("2026-07-25T12:00:00Z"); // Saturday

describe("analyticsDayLabel", () => {
  it("says Danas and Juče for the two days everyone recognises", () => {
    expect(analyticsDayLabel("2026-07-25", NOW)).toBe("Danas");
    expect(analyticsDayLabel("2026-07-24", NOW)).toBe("Juče");
  });

  it("names older days with a capitalised weekday and the date", () => {
    expect(analyticsDayLabel("2026-07-22", NOW)).toBe("Sreda, 22. jul");
    expect(analyticsDayLabel("2026-07-20", NOW)).toBe("Ponedeljak, 20. jul");
  });

  it("still names a day in a different month", () => {
    expect(analyticsDayLabel("2026-06-30", NOW)).toBe("Utorak, 30. jun");
  });

  it("handles a 'now' just after Belgrade midnight (day rolls over)", () => {
    // 2026-07-25T22:30Z is already 2026-07-26 in Belgrade (UTC+2).
    const afterMidnight = new Date("2026-07-25T22:30:00Z");
    expect(analyticsDayLabel("2026-07-26", afterMidnight)).toBe("Danas");
    expect(analyticsDayLabel("2026-07-25", afterMidnight)).toBe("Juče");
  });
});
