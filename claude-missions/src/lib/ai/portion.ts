/**
 * The user's own portion estimate — Prizma's answer to the one thing a camera
 * structurally cannot do.
 *
 * Two numbers decide whether a meal estimate is right: how much food there is,
 * and how much fat is hiding in it. A photo bounds neither. The person holding
 * the phone is standing over the plate and can bound both in about four
 * seconds, so we ask -- once, right after the first shot, while they are still
 * looking at what they photographed.
 *
 * It is a PRIOR, not a truth. The model is told to start from it and to
 * override it when the photos plainly disagree, because a confidently wrong
 * "300 g" must not be able to drag a clearly-500 g plate down with it. What the
 * step buys is not the number itself so much as the scale it pins: once mass is
 * roughly fixed, everything else the model computes is anchored.
 */

export const PORTION_MIN_G = 50;
export const PORTION_MAX_G = 900;
/** Where the dial opens: a full standard plate, the most common real answer. */
export const PORTION_DEFAULT_G = 300;

/** Plain-language read-out under the gram figure, so the number is never alone. */
export function portionHint(grams: number): string {
  if (grams < 120) return "zalogaj-dva";
  if (grams < 200) return "mala porcija";
  if (grams < 300) return "otprilike pola tanjira";
  if (grams < 430) return "pun tanjir";
  if (grams < 620) return "pun tanjir i navrh";
  return "velika porcija — dva tanjira";
}

/**
 * How it was cooked. This is the second half of the step and the cheaper half
 * to answer: one tap, and it moves the estimate more than the grams do at the
 * margins. A tablespoon of oil is 126 kcal and visually almost invisible;
 * breaded-and-fried is +30-40% over the same food grilled. No photo shows that.
 */
export const PREP_METHODS = ["kuvano", "bez_ulja", "malo_ulja", "przeno"] as const;
export type PrepMethod = (typeof PREP_METHODS)[number];

export const PREP_LABELS: Record<PrepMethod, string> = {
  kuvano: "Kuvano / na pari",
  bez_ulja: "Pečeno bez ulja",
  malo_ulja: "Na malo ulja",
  przeno: "Prženo / pohovano",
};

/** What each choice means in grams of added fat, spelled out for the model. */
const PREP_HINTS: Record<PrepMethod, string> = {
  kuvano:
    "Priprema: KUVANO ili na pari — bez dodate masti. Ne dodaj ulje kao komponentu.",
  bez_ulja:
    "Priprema: PEČENO U RERNI / air fryer bez ulja — dodaj najviše 0–2 g masti.",
  malo_ulja:
    "Priprema: NA MALO ULJA (tiganj) — računaj otprilike 8–12 g ulja kao zasebnu komponentu.",
  przeno:
    "Priprema: PRŽENO ili POHOVANO u dubljoj masti — računaj 15–25 g ulja kao zasebnu komponentu (pohovano nosi +30–40% kcal).",
};

export function isPrepMethod(value: unknown): value is PrepMethod {
  return (
    typeof value === "string" && PREP_METHODS.includes(value as PrepMethod)
  );
}

/**
 * Turn the step's two answers into the block of prompt text both Prizma calls
 * receive.
 *
 * The tolerance band is stated explicitly (±35%) rather than left implicit,
 * because the failure mode we care about is the model treating a rough human
 * guess as a measurement. It also tells the model NOT to spend one of its at
 * most three questions re-asking what was just answered -- which is the real
 * win of this step: it doesn't add a question, it trades a weak one for a
 * strong one.
 */
export function describeUserPortion(
  grams: number | null,
  prep: PrepMethod | null
): string {
  if (grams == null && prep == null) return "";

  const lines: string[] = ["KORISNIK JE VEĆ ODGOVORIO (stojeći nad tanjirom):"];

  if (grams != null) {
    const low = Math.round(grams * 0.65);
    const high = Math.round(grams * 1.35);
    lines.push(
      `- Ukupna masa obroka: OTPRILIKE ${grams} g (${portionHint(grams)}).`,
      `  To je gruba ljudska procena, ne merenje. Uzmi je kao POLAZNU RAZMERU i drži se opsega ${low}–${high} g.`,
      `  Izađi iz tog opsega samo ako slike to jasno pokazuju; ako izađeš, obrazloži u "napomena".`
    );
  }

  if (prep != null) lines.push(`- ${PREP_HINTS[prep]}`);

  lines.push(
    "NE PITAJ ponovo ni koliko je pojedeno ni kako je pripremljeno — to je već odgovoreno.",
    "Pitanja troši na ono što i dalje ne znaš (koji sastojak, šta je ispod, ima li sosa/dresinga)."
  );

  return lines.join("\n");
}
