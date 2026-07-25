import { describe, expect, it } from "vitest";

import {
  describeShots,
  MAX_QUESTIONS,
  parsePrizmaAnalysis,
} from "@/lib/ai/prizma";

function question(pitanje: string, uticaj_kcal: number, stavka = "") {
  return {
    stavka,
    pitanje,
    opcije: ["Da", "Ne"],
    zasto: "test",
    uticaj_kcal,
  };
}

function seen(stavka: string, sigurnost: "niska" | "srednja" | "visoka") {
  return { stavka, sigurnost, nejasno: "" };
}

describe("parsePrizmaAnalysis", () => {
  it("orders questions by how much they move the estimate", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        pitanja: [question("malo", 40), question("puno", 280), question("srednje", 120)],
      },
      "obrok"
    );
    expect(result.status).toBe("pitanja");
    if (result.status !== "pitanja") return;
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "puno",
      "srednje",
      "malo",
    ]);
  });

  it("keeps only the highest-impact questions", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        pitanja: [
          question("a", 10),
          question("b", 20),
          question("c", 30),
          question("d", 40),
          question("e", 50),
        ],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.pitanja).toHaveLength(MAX_QUESTIONS);
    expect(result.pitanja[0].pitanje).toBe("e");
  });

  it("drops questions that don't offer a real choice", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        pitanja: [
          { ...question("jedna opcija", 500), opcije: ["Samo ovo"] },
          question("prava", 100),
        ],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.pitanja).toHaveLength(1);
    expect(result.pitanja[0].pitanje).toBe("prava");
  });

  it("falls back to the portion question instead of dead-ending", () => {
    const result = parsePrizmaAnalysis({ status: "pitanja", pitanja: [] }, "obrok");
    if (result.status !== "pitanja") return;
    expect(result.pitanja).toHaveLength(1);
    expect(result.pitanja[0].opcije.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps only questions bound to an item the model was unsure about", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        vidim: [seen("pileće belo", "visoka"), seen("sos ispod mesa", "niska")],
        pitanja: [
          // Highest impact, but about something it says it sees clearly.
          question("Koliko je mesa?", 400, "pileće belo"),
          question("Pavlaka ili majonez?", 150, "sos ispod mesa"),
        ],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.source).toBe("derived");
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "Pavlaka ili majonez?",
    ]);
  });

  it("matches the item loosely, ignoring case and diacritics", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        vidim: [seen("Pileće belo meso", "srednja")],
        pitanja: [question("Kako je spremljeno?", 200, "pilece belo")],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.source).toBe("derived");
    expect(result.pitanja).toHaveLength(1);
  });

  it("cuts template questions down to one when none is bound to doubt", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        vidim: [seen("pasulj", "visoka")],
        pitanja: [
          question("Šta si jeo?", 100),
          question("Kako je pripremljeno?", 300),
          question("Koliko si pojeo?", 200),
        ],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.source).toBe("unbound");
    // Only the most valuable one survives -- three unearned questions is the
    // complaint we are fixing.
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "Kako je pripremljeno?",
    ]);
  });

  it("lets questions through untouched when no inventory came back", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        pitanja: [question("a", 100), question("b", 200)],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.source).toBe("unverified");
    expect(result.pitanja).toHaveLength(2);
  });

  it("names the food in the fallback question when it knows what it saw", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "pitanja",
        vidim: [seen("pasulj", "niska"), seen("hleb", "srednja")],
        pitanja: [],
      },
      "obrok"
    );
    if (result.status !== "pitanja") return;
    expect(result.source).toBe("fallback");
    expect(result.pitanja[0].pitanje).toBe("Koliko si pojeo — pasulj i hleb?");
  });

  it("still asks the plain portion question with no inventory at all", () => {
    const result = parsePrizmaAnalysis({ status: "pitanja", pitanja: [] }, "obrok");
    if (result.status !== "pitanja") return;
    expect(result.pitanja[0].pitanje).toBe("Koliko si pojeo?");
  });

  it("passes a confident estimate straight through", () => {
    const result = parsePrizmaAnalysis(
      {
        status: "procena",
        naziv: "Pileća supa",
        procenjeni_grami: 300,
        kcal: 180,
        protein_g: 12,
        uh_g: 14,
        mast_g: 7,
        sigurnost: "visoka",
      },
      "obrok"
    );
    expect(result.status).toBe("procena");
    if (result.status !== "procena") return;
    expect(result.estimate.naziv).toBe("Pileća supa");
  });

  it("asks rather than returning a malformed estimate", () => {
    const result = parsePrizmaAnalysis(
      { status: "procena", pitanja: [question("koliko", 200)] },
      "obrok"
    );
    // No usable estimate fields -> must degrade to questions, not garbage.
    expect(result.status).toBe("pitanja");
  });
});

describe("describeShots", () => {
  it("names both viewpoints when two angles were captured", () => {
    const text = describeShots(2, "viljuska");
    expect(text).toContain("ODOZGO");
    expect(text).toContain("45");
    expect(text).toContain("VILJUŠKA");
  });

  it("warns the model when only one angle exists", () => {
    const text = describeShots(1, "nista");
    expect(text).toContain("SAMO JEDNA");
    expect(text).toContain("snizi sigurnost");
  });

  it("mentions the extra angles beyond the required two", () => {
    expect(describeShots(4, "kasika")).toContain("Ostale slike (2)");
  });
});
