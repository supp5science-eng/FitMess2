import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { DateStrip } from "@/components/home/date-strip";
import { buildDateStrip } from "@/lib/home/date-strip";

// The date strip is how you "go back to a past day" on /danas: tapping a past
// (or today) cell navigates to `/danas?dan=YYYY-MM-DD` (today -> bare /danas),
// where the Server Component re-reads that day's data. Future and pre-sign-up
// cells exist only as faint, NON-tappable filler. These tests lock that wiring
// so the past-day navigation the dashboard depends on can't silently regress.

// Fixed "now": 2026-07-19. Sign-up on 2026-07-17, so 07-15/07-16 are
// pre-sign-up filler; 07-20/07-21 are the future.
const NOW = new Date("2026-07-19T12:00:00.000Z");

function strip() {
  const days = buildDateStrip({
    now: NOW,
    selectedKey: "2026-07-19",
    loggedDays: new Set(["2026-07-18"]),
    startKey: "2026-07-15",
    endKey: "2026-07-21",
    minKey: "2026-07-17",
  });
  return render(<DateStrip days={days} />);
}

describe("DateStrip: past-day navigation wiring", () => {
  it("test_a_past_logged_day_links_to_that_days_danas_view", () => {
    strip();
    expect(
      screen.getByRole("link", { name: "18. jul — uneo si obrok" })
    ).toHaveAttribute("href", "/danas?dan=2026-07-18");
  });

  it("test_the_signup_day_is_a_tappable_past_day", () => {
    strip();
    expect(screen.getByRole("link", { name: "17. jul" })).toHaveAttribute(
      "href",
      "/danas?dan=2026-07-17"
    );
  });

  it("test_today_links_to_bare_danas", () => {
    strip();
    expect(
      screen.getByRole("link", { name: "Danas, 19. jul" })
    ).toHaveAttribute("href", "/danas");
  });

  it("test_only_past_and_today_cells_are_tappable_future_and_presignup_are_not", () => {
    strip();
    // Tappable: 07-17 (sign-up), 07-18 (past), 07-19 (today). NOT tappable:
    // 07-15 / 07-16 (pre-sign-up) and 07-20 / 07-21 (future).
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/danas?dan=2026-07-20");
    expect(hrefs).not.toContain("/danas?dan=2026-07-16");
  });
});
