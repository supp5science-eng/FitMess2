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

describe("parsePrizmaAnalysis — questions", () => {
  it("orders questions by how much they move the estimate", () => {
    const result = parsePrizmaAnalysis(
      {
        pitanja: [question("malo", 40), question("puno", 280), question("srednje", 120)],
      },
      "obrok"
    );
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "puno",
      "srednje",
      "malo",
    ]);
  });

  it("keeps only the highest-impact questions", () => {
    const result = parsePrizmaAnalysis(
      {
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
    expect(result.pitanja).toHaveLength(MAX_QUESTIONS);
    expect(result.pitanja[0].pitanje).toBe("e");
  });

  it("drops questions that don't offer a real choice", () => {
    const result = parsePrizmaAnalysis(
      {
        pitanja: [
          { ...question("jedna opcija", 500), opcije: ["Samo ovo"] },
          question("prava", 100),
        ],
      },
      "obrok"
    );
    expect(result.pitanja).toHaveLength(1);
    expect(result.pitanja[0].pitanje).toBe("prava");
  });

  it("treats no question as a clean result, not a failure", () => {
    // The dial carries the portion now, so there is nothing we must ask. The
    // old code invented a stock "Koliko si pojeo?" here, which is exactly the
    // generic-feeling question users complained about.
    const result = parsePrizmaAnalysis({ pitanja: [] }, "obrok");
    expect(result.pitanja).toEqual([]);
    expect(result.source).toBe("none");
  });

  it("keeps only questions bound to an item the model was unsure about", () => {
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("pileće belo", "visoka"), seen("sos ispod mesa", "niska")],
        pitanja: [
          // Highest impact, but about something it says it sees clearly.
          question("Koliko je mesa?", 400, "pileće belo"),
          question("Pavlaka ili majonez?", 150, "sos ispod mesa"),
        ],
      },
      "obrok"
    );
    expect(result.source).toBe("derived");
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "Pavlaka ili majonez?",
    ]);
  });

  it("matches the item loosely, ignoring case and diacritics", () => {
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("Pileće belo meso", "srednja")],
        pitanja: [question("Ima li sos preko mesa?", 200, "pilece belo")],
      },
      "obrok"
    );
    expect(result.source).toBe("derived");
    expect(result.pitanja).toHaveLength(1);
  });

  it("cuts template questions down to one when none is bound to doubt", () => {
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("pasulj", "visoka")],
        pitanja: [
          question("Šta si jeo?", 100),
          question("Ima li dimljenog mesa unutra?", 300),
          question("Koliko si pojeo?", 200),
        ],
      },
      "obrok"
    );
    expect(result.source).toBe("unbound");
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "Ima li dimljenog mesa unutra?",
    ]);
  });

  it("drops questions about how the food was cooked", () => {
    // The app owns that question -- one tap under the dial, or, for food nobody
    // cooks, not at all. A model that asks it anyway spends a slot on an answer
    // we already have, and on an ice cream asks something that never happened.
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("piletina", "srednja")],
        pitanja: [
          question("Da li je piletina pohovana?", 400, "piletina"),
          question("Kako je pripremljeno?", 350, "piletina"),
          question("Je l' prženo na ulju?", 300, "piletina"),
          question("Ima li sira u fileu?", 90, "piletina"),
        ],
      },
      "obrok"
    );
    expect(result.pitanja.map((q) => q.pitanje)).toEqual([
      "Ima li sira u fileu?",
    ]);
  });

  it("keeps a question about an item whose NAME mentions breading", () => {
    // "pohovana piletina" is a perfectly good item to ask something else about;
    // only the question text decides.
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("pohovana piletina", "srednja")],
        pitanja: [question("Čime je punjena?", 200, "pohovana piletina")],
      },
      "obrok"
    );
    expect(result.pitanja).toHaveLength(1);
  });

  it("leaves nothing to ask when every question was about the cooking", () => {
    const result = parsePrizmaAnalysis(
      {
        vidim: [seen("krompir", "srednja")],
        pitanja: [question("Prženo ili kuvano?", 300, "krompir")],
      },
      "obrok"
    );
    expect(result.pitanja).toEqual([]);
    expect(result.source).toBe("none");
  });

  it("lets questions through untouched when no inventory came back", () => {
    const result = parsePrizmaAnalysis(
      { pitanja: [question("a", 100), question("b", 200)] },
      "obrok"
    );
    expect(result.source).toBe("unverified");
    expect(result.pitanja).toHaveLength(2);
  });
});

describe("parsePrizmaAnalysis — vessel and unit", () => {
  it("takes the model's vessel call and its mass for one unit", () => {
    const result = parsePrizmaAnalysis(
      {
        naziv: "Palačinke",
        posuda: "komadi",
        jedinica_naziv: "palačinka",
        jedinica_grami: 62,
        pitanja: [],
      },
      "obrok"
    );
    expect(result.naziv).toBe("Palačinke");
    expect(result.posuda).toBe("komadi");
    expect(result.jedinica).toEqual({ naziv: "palačinka", grami: 62 });
  });

  it("falls back to an ordinary plate when the model says nothing usable", () => {
    const result = parsePrizmaAnalysis({}, "obrok");
    expect(result.posuda).toBe("ravan");
    expect(result.jedinica.grami).toBeGreaterThan(0);
    expect(result.pitanja).toEqual([]);
  });

  it("clamps an absurd unit mass instead of handing it to the dial", () => {
    // One pancake is not five kilograms; letting this through would scale the
    // user's every drag into nonsense.
    const result = parsePrizmaAnalysis(
      { posuda: "komadi", jedinica_naziv: "palačinka", jedinica_grami: 5000 },
      "obrok"
    );
    expect(result.jedinica.grami).toBeLessThanOrEqual(600);
  });

  it("ignores an unknown vessel name", () => {
    const result = parsePrizmaAnalysis({ posuda: "tanjirčić" }, "obrok");
    expect(result.posuda).toBe("ravan");
  });

  it("forces the label flow onto the plain dial", () => {
    const result = parsePrizmaAnalysis({ posuda: "dubok" }, "deklaracija");
    expect(result.posuda).toBe("ravan");
  });
});

describe("parsePrizmaAnalysis — is preparation even a thing here", () => {
  it("drops the cooking question for food nobody cooked", () => {
    // The complaint that started this: a scoop of ice cream, recognised as ice
    // cream, and then asked whether it was fried or breaded.
    const result = parsePrizmaAnalysis(
      { naziv: "Sladoled", posuda: "dubok", priprema_bitna: false },
      "obrok"
    );
    expect(result.pripremaBitna).toBe(false);
  });

  it("keeps it for a plate someone actually cooked", () => {
    expect(
      parsePrizmaAnalysis({ priprema_bitna: true }, "obrok").pripremaBitna
    ).toBe(true);
  });

  it("keeps it when the model says nothing — a missed spoon of oil costs more than a tap", () => {
    expect(parsePrizmaAnalysis({}, "obrok").pripremaBitna).toBe(true);
    expect(
      parsePrizmaAnalysis({ priprema_bitna: "ne" }, "obrok").pripremaBitna
    ).toBe(true);
  });

  it("never asks it on a nutrition label — the box already says", () => {
    expect(
      parsePrizmaAnalysis({ priprema_bitna: true }, "deklaracija").pripremaBitna
    ).toBe(false);
  });
});

describe("parsePrizmaAnalysis — measured scale", () => {
  it("keeps the measured diameter and how it was arrived at", () => {
    const result = parsePrizmaAnalysis(
      { tanjir_cm: 26, razmera_po_referenci: true },
      "obrok"
    );
    expect(result.razmera).toEqual({ cm: 26, poReferenci: true });
  });

  it("rejects a diameter no plate can have", () => {
    // A wild reading here would silently inflate every coverage-based mass,
    // and would also make the logs useless for judging whether the fork works.
    expect(parsePrizmaAnalysis({ tanjir_cm: 200 }, "obrok").razmera.cm).toBeNull();
    expect(parsePrizmaAnalysis({ tanjir_cm: 3 }, "obrok").razmera.cm).toBeNull();
    expect(parsePrizmaAnalysis({}, "obrok").razmera.cm).toBeNull();
  });

  it("only counts the reference object when the model says it used one", () => {
    expect(
      parsePrizmaAnalysis({ tanjir_cm: 26 }, "obrok").razmera.poReferenci
    ).toBe(false);
  });
});

describe("parsePrizmaAnalysis — the extra angle", () => {
  it("asks for one only when the model explicitly says so", () => {
    const asked = parsePrizmaAnalysis(
      { treba_ugao: true, ugao_zasto: "Ne vidim šta je ispod mesa." },
      "obrok"
    );
    expect(asked.ugao).toEqual({
      treba: true,
      zasto: "Ne vidim šta je ispod mesa.",
    });
  });

  it("defaults to not asking — a photo everyone must take is the costly step", () => {
    expect(parsePrizmaAnalysis({}, "obrok").ugao.treba).toBe(false);
    expect(parsePrizmaAnalysis({ treba_ugao: "da" }, "obrok").ugao.treba).toBe(
      false
    );
  });
});

describe("parsePrizmaAnalysis — no food on the photo", () => {
  it("flags a photo with no food (meal variant)", () => {
    const result = parsePrizmaAnalysis(
      { nema_hrane: true, pitanja: [] },
      "obrok"
    );
    expect(result.nemaHrane).toBe(true);
  });

  it("defaults to 'there is food' when unflagged or not a real boolean", () => {
    expect(parsePrizmaAnalysis({ pitanja: [] }, "obrok").nemaHrane).toBe(false);
    // Only a strict `true` counts -- a stray string must not block a real meal.
    expect(parsePrizmaAnalysis({ nema_hrane: "da" }, "obrok").nemaHrane).toBe(false);
  });

  it("never flags no-food on the label variant (a label isn't a plate)", () => {
    expect(
      parsePrizmaAnalysis({ nema_hrane: true }, "deklaracija").nemaHrane
    ).toBe(false);
  });
});

describe("describeShots", () => {
  it("names both viewpoints when two angles were captured", () => {
    const text = describeShots(2, "viljuska");
    expect(text).toContain("ODOZGO");
    expect(text).toContain("UGLOM");
    expect(text).toContain("VILJUŠKA");
  });

  it("points the model at the user's description when there is one photo", () => {
    // One shot is the normal case now, so this must not read as a degraded
    // input: telling the model to lower its confidence would make it hedge
    // against information it actually has.
    const text = describeShots(1, "nista");
    expect(text).toContain("JEDNA slika");
    expect(text).toContain("korisnikov opis oblika");
    expect(text).not.toContain("snizi sigurnost");
  });

  it("mentions the extra angles beyond the required two", () => {
    expect(describeShots(4, "kasika")).toContain("Ostale slike (2)");
  });
});
