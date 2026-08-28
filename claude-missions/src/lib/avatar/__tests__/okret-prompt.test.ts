import { describe, expect, it } from "vitest";

import {
  buildOkretKadarPrompt,
  buildOkretVideoPrompt,
  MAX_OKRET_SLIKA,
  MIN_OKRET_SLIKA,
  okretAspect,
  OKRET_KADROVI,
  okretVremenaFrejmova,
  proveriBrojSlika,
} from "@/lib/avatar/okret-prompt";

/**
 * Okret nasleđuje jedini invarijant klona -- ŠABLON JE ISTI ZA SVAKOGA -- i
 * dodaje jedan svoj: orbit sme da menja UGAO i ništa drugo.
 *
 * Oba se lako izgube tihо. Prompt koji se razlikuje po korisniku pravi avatare
 * koji ne mogu da stoje jedan pored drugog, a video prompt koji dozvoli da se
 * čovek pomeri pravi niz u kom je svaki kadar druga poza -- i to se ne vidi na
 * pojedinačnoj slici, nego tek kad se prevuče prstom.
 */
describe("okret: šablon kadra", () => {
  it("se između dva korisnika razlikuje samo po broju slika", () => {
    const pet = buildOkretKadarPrompt("portret", 5).replace("5 fotografija", "N");
    const dvadeset = buildOkretKadarPrompt("portret", 20).replace(
      "20 fotografija",
      "N"
    );
    expect(pet).toBe(dvadeset);
  });

  it("kaže modelu koliko slika gleda", () => {
    expect(buildOkretKadarPrompt("figura", 7)).toContain("7 fotografija");
  });

  it("traži fotografiju, a ne crtež — to je cela razlika od klona", () => {
    for (const kadar of OKRET_KADROVI) {
      const prompt = buildOkretKadarPrompt(kadar, MIN_OKRET_SLIKA);
      expect(prompt).toContain("FOTOGRAFIJU");
      expect(prompt).toContain("a ne kao");
      expect(prompt).toContain("3D render");
    }
  });

  it("drži belu pozadinu u obe varijante — avatar se slaže na papir", () => {
    for (const kadar of OKRET_KADROVI) {
      const prompt = buildOkretKadarPrompt(kadar, MIN_OKRET_SLIKA);
      expect(prompt).toContain("Čisto bela");
      expect(prompt).toContain("Bez senke na podu");
    }
  });

  it("razlikuje dva kadra tačno tamo gde treba", () => {
    const portret = buildOkretKadarPrompt("portret", 10);
    const figura = buildOkretKadarPrompt("figura", 10);

    expect(portret).toContain("Glava i ramena");
    expect(figura).toContain("Cela figura");
    // Odeća postoji samo tamo gde se vidi telo koje je nosi.
    expect(figura).toContain("patike");
    expect(portret).not.toContain("patike");
  });

  it("zabranjuje uzimanje odeće i pozadine sa fotografija", () => {
    const prompt = buildOkretKadarPrompt("portret", MIN_OKRET_SLIKA);
    expect(prompt).toContain("ŠTA NIKAKO NE UZIMAŠ");
    expect(prompt).toContain("Odeću, pozadinu, osvetljenje, pozu");
  });

  it("pominje referentni portret samo kad ga stvarno ima", () => {
    expect(buildOkretKadarPrompt("portret", 8, true)).toContain(
      "POSLEDNJA priložena slika"
    );
    expect(buildOkretKadarPrompt("portret", 8, false)).not.toContain(
      "POSLEDNJA priložena slika"
    );
  });
});

describe("okret: šablon orbita", () => {
  it("pomera kameru, a ne čoveka — inače je svaki kadar druga poza", () => {
    const prompt = buildOkretVideoPrompt("portret");
    expect(prompt).toContain("Kreće se SAMO kamera");
    expect(prompt).toContain("OSOBA JE POTPUNO NEPOMIČNA");
  });

  it("zabranjuje tri načina na koja se niz raspadne", () => {
    const prompt = buildOkretVideoPrompt("figura");
    expect(prompt).toContain("Ne trepće");
    expect(prompt).toContain("Bez zuma");
    expect(prompt).toContain("Ostaje na istoj visini");
  });

  it("deli traženi luk na dve polovine oko čoveka", () => {
    expect(buildOkretVideoPrompt("portret", 180)).toContain("90 stepeni");
    expect(buildOkretVideoPrompt("portret", 180)).toContain("ukupno 180 stepeni");
    expect(buildOkretVideoPrompt("portret", 120)).toContain("60 stepeni");
  });

  it("se između dva korisnika ne razlikuje ni po čemu", () => {
    expect(buildOkretVideoPrompt("portret", 180)).toBe(
      buildOkretVideoPrompt("portret", 180)
    );
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

  it("daje portretu 3:4, a figuri 9:16", () => {
    expect(okretAspect("portret")).toBe("3:4");
    expect(okretAspect("figura")).toBe("9:16");
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
