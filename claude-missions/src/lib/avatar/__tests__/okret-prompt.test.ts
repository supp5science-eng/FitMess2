import { describe, expect, it } from "vitest";

import {
  buildOkretKadarPrompt,
  buildOkretVideoPrompt,
  MAX_OKRET_SLIKA,
  MIN_OKRET_SLIKA,
  OKRET_ASPECT,
  okretNegativePrompt,
  okretVremenaFrejmova,
  proveriBrojSlika,
} from "@/lib/avatar/okret-prompt";

/**
 * Okret nasleđuje jedini invarijant klona -- ŠABLON JE ISTI ZA SVAKOGA -- i
 * dodaje dva svoja: orbit sme da menja UGAO i ništa drugo, a odeća se UZIMA sa
 * fotografija umesto da se izmišlja.
 *
 * Sva tri se lako izgube tiho. Prompt koji se razlikuje po korisniku pravi
 * avatare koji ne mogu da stoje jedan pored drugog; video prompt koji dozvoli
 * da se čovek pomeri pravi niz u kom je svaki kadar druga poza; a pravilo o
 * odeći je jedina razlika u odnosu na klon, gde je isto pravilo OKRENUTO.
 */
describe("okret: šablon kadra", () => {
  it("se između dva korisnika razlikuje samo po broju slika", () => {
    const pet = buildOkretKadarPrompt(5).replace("5 fotografija", "N");
    const dvadeset = buildOkretKadarPrompt(20).replace("20 fotografija", "N");
    expect(pet).toBe(dvadeset);
  });

  it("kaže modelu koliko slika gleda", () => {
    expect(buildOkretKadarPrompt(7)).toContain("7 fotografija");
  });

  it("imenuje žanr u prvoj rečenici", () => {
    // Uska, prepoznatljiva odrednica vredi više od deset prideva iza nje.
    expect(buildOkretKadarPrompt(10).split("\n")[0]).toContain(
      "veb-prodavnicu"
    );
  });

  it("traži SVETLO SIVU pozadinu, ne belu — v1 je baš na tome pao", () => {
    const prompt = buildOkretKadarPrompt(MIN_OKRET_SLIKA);
    expect(prompt).toContain("SVETLO SIVE");
    expect(prompt).toContain("NIJE\n  čisto beo");
    // "Izrezan i nalepljen" je ono što bela pozadina proizvede.
    expect(prompt).toContain("nije izrezan i nalepljen");
  });

  it("nosi fotografski rečnik, a ne pridev 'realistično'", () => {
    const prompt = buildOkretKadarPrompt(MIN_OKRET_SLIKA);
    expect(prompt).toContain("85mm");
    expect(prompt).toContain("f/5.6");
    expect(prompt).toContain("softboksa");
  });

  it("izričito zabranjuje ono što sliku odaje kao generisanu", () => {
    const prompt = buildOkretKadarPrompt(MIN_OKRET_SLIKA);
    expect(prompt).toContain("NE OVAKO");
    expect(prompt).toContain("retuširanja");
    expect(prompt).toContain("plitke dubinske oštrine");
    expect(prompt).toContain("plastične i voštane kože");
  });

  it("UZIMA odeću sa fotografija — obrnuto od klona", () => {
    const prompt = buildOkretKadarPrompt(MIN_OKRET_SLIKA);
    expect(prompt).toContain("UZIMA SE SA FOTOGRAFIJA, NIKAD SE NE IZMIŠLJA");
    // Rečenica koja nosi celo pravilo: bez nje model bira lepše, ne jasnije.
    expect(prompt).toContain("najbolje VIDIŠ");
    expect(prompt).toContain("Ne mešaj komade sa različitih fotografija");
  });

  it("drži kadar na glavi i ramenima", () => {
    const prompt = buildOkretKadarPrompt(10);
    expect(prompt).toContain("Glava i ramena");
    expect(prompt).toContain("3:4");
    expect(OKRET_ASPECT).toBe("3:4");
  });

  it("pominje referentni portret samo kad ga stvarno ima", () => {
    expect(buildOkretKadarPrompt(8, true)).toContain("POSLEDNJA priložena slika");
    expect(buildOkretKadarPrompt(8, false)).not.toContain(
      "POSLEDNJA priložena slika"
    );
  });
});

describe("okret: šablon orbita", () => {
  it("pomera kameru, a ne čoveka — inače je svaki kadar druga poza", () => {
    const prompt = buildOkretVideoPrompt();
    expect(prompt).toContain("Kreće se SAMO kamera");
    expect(prompt).toContain("OSOBA JE POTPUNO NEPOMIČNA");
  });

  it("zabranjuje tri načina na koja se niz raspadne", () => {
    const prompt = buildOkretVideoPrompt();
    expect(prompt).toContain("Ne trepće");
    expect(prompt).toContain("Bez zuma");
    expect(prompt).toContain("Ostaje na istoj visini");
  });

  it("drži istu sivu pozadinu kroz ceo luk", () => {
    // Bez ovoga model "očisti" pozadinu u belo negde na sredini, pa se pola
    // frejmova ne slaže sa drugom polovinom.
    expect(buildOkretVideoPrompt()).toContain("bešavna svetlo siva");
  });

  it("deli traženi luk na dve polovine oko čoveka", () => {
    expect(buildOkretVideoPrompt(180)).toContain("90 stepeni");
    expect(buildOkretVideoPrompt(180)).toContain("ukupno 180 stepeni");
    expect(buildOkretVideoPrompt(120)).toContain("60 stepeni");
  });
});

describe("okret: negativni prompt", () => {
  it("NE zabranjuje sivu pozadinu — šablon je traži", () => {
    // v1 je zabranjivao "grey background" dok je šablon tražio sivu. Te dve
    // instrukcije su se tukle, i to se plaća celim jednim orbitom.
    const negativ = okretNegativePrompt();
    expect(negativ).not.toContain("siva pozadina");
    expect(negativ).toContain("tamna pozadina");
    expect(negativ).toContain("obojena pozadina");
  });

  it("zabranjuje pomeranje osobe i rezove", () => {
    const negativ = okretNegativePrompt();
    expect(negativ).toContain("osoba se okreće");
    expect(negativ).toContain("trepće");
    expect(negativ).toContain("rez");
  });
});

describe("okret: brojevi", () => {
  it("drži granicu 5-20 sa rečenicom koja kaže koliko fali", () => {
    expect(proveriBrojSlika(MIN_OKRET_SLIKA).ok).toBe(true);
    expect(proveriBrojSlika(MAX_OKRET_SLIKA).ok).toBe(true);

    const malo = proveriBrojSlika(3);
    expect(malo.ok).toBe(false);
    if (!malo.ok) expect(malo.error_sr).toContain("još 2");

    const mnogo = proveriBrojSlika(23);
    expect(mnogo.ok).toBe(false);
    if (!mnogo.ok) expect(mnogo.error_sr).toContain("Izbaci 3");
  });
});

describe("okret: vremena frejmova", () => {
  it("vraća tačno onoliko kadrova koliko je traženo", () => {
    expect(okretVremenaFrejmova(5, 19)).toHaveLength(19);
    expect(okretVremenaFrejmova(8, 36)).toHaveLength(36);
  });

  it("preskače sam početak i sam kraj snimka", () => {
    const vremena = okretVremenaFrejmova(5, 19, 0.15);
    expect(vremena[0]).toBeCloseTo(0.15, 3);
    expect(vremena[vremena.length - 1]).toBeCloseTo(4.85, 3);
  });

  it("razmiče kadrove ravnomerno — luk se prelazi istom brzinom", () => {
    const vremena = okretVremenaFrejmova(5, 5, 0);
    const koraci = vremena.slice(1).map((t, i) => t - vremena[i]);
    for (const korak of koraci) expect(korak).toBeCloseTo(koraci[0], 3);
  });

  it("ne pukne kad se traži jedan kadar", () => {
    expect(okretVremenaFrejmova(5, 1)).toHaveLength(1);
  });

  it("ostaje unutar trajanja snimka", () => {
    for (const t of okretVremenaFrejmova(5, 40)) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(5);
    }
  });
});
