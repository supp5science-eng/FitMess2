import { describe, expect, it } from "vitest";

import { SNACK_KCAL_CEILING, rankFrequentSnacks } from "@/lib/gric/frequent";

const row = (
  name: string,
  kcal: number,
  logged_at: string,
  grams = 100
) => ({
  name,
  grams,
  kcal,
  protein: 1,
  carbs: 10,
  fat: 0.5,
  logged_at,
});

describe("rankFrequentSnacks", () => {
  it("ranks by how often the snack was logged", () => {
    const ranked = rankFrequentSnacks([
      row("Kafa", 5, "2026-07-25T09:00:00Z"),
      row("Jabuka", 90, "2026-07-24T15:00:00Z"),
      row("Kafa", 5, "2026-07-24T09:00:00Z"),
      row("Kafa", 5, "2026-07-23T09:00:00Z"),
      row("Jabuka", 90, "2026-07-23T15:00:00Z"),
      row("Kajsije", 38, "2026-07-22T17:00:00Z"),
    ]);

    expect(ranked.map((s) => s.name)).toEqual(["Kafa", "Jabuka", "Kajsije"]);
    expect(ranked[0].count).toBe(3);
  });

  it("treats different spellings of one habit as the same snack", () => {
    const ranked = rankFrequentSnacks([
      row("Kajsije", 38, "2026-07-25T10:00:00Z"),
      row("kajsije ", 38, "2026-07-24T10:00:00Z"),
      row("KAJSIJE", 38, "2026-07-23T10:00:00Z"),
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].count).toBe(3);
    // The most recent spelling is what the chip shows.
    expect(ranked[0].name).toBe("Kajsije");
  });

  it("re-logs the most recent portion, not the oldest one", () => {
    const ranked = rankFrequentSnacks([
      row("Jogurt", 120, "2026-07-25T08:00:00Z", 200),
      row("Jogurt", 90, "2026-07-20T08:00:00Z", 150),
    ]);

    expect(ranked[0].grams).toBe(200);
    expect(ranked[0].kcal).toBe(120);
  });

  it("leaves out full meals — this row is for snacks", () => {
    const ranked = rankFrequentSnacks([
      row("Pasulj sa kobasicom", SNACK_KCAL_CEILING + 1, "2026-07-25T13:00:00Z"),
      row("Krastavac", 24, "2026-07-25T16:00:00Z"),
    ]);

    expect(ranked.map((s) => s.name)).toEqual(["Krastavac"]);
  });

  it("coerces PostgREST numeric strings", () => {
    const ranked = rankFrequentSnacks([
      {
        name: "Badem",
        grams: "25.0",
        kcal: "145.0",
        protein: "5.3",
        carbs: "5.4",
        fat: "12.6",
        logged_at: "2026-07-25T11:00:00Z",
      },
    ]);

    expect(ranked[0].kcal).toBe(145);
    expect(ranked[0].fat).toBe(12.6);
  });

  it("caps the list so the row stays scannable", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row(`Sitnica ${i}`, 50, "2026-07-25T10:00:00Z")
    );
    expect(rankFrequentSnacks(rows)).toHaveLength(6);
  });

  it("skips blank names rather than rendering an empty chip", () => {
    expect(rankFrequentSnacks([row("   ", 20, "2026-07-25T10:00:00Z")])).toEqual([]);
  });
});
