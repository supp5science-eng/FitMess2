/**
 * The user's own portion call — Prizma's answer to the one thing a camera
 * structurally cannot do.
 *
 * Two numbers decide whether a meal estimate is right: how much food there is,
 * and how much fat is hiding in it. A photo bounds neither. The person holding
 * the phone is standing over the plate and can bound both in a few seconds, so
 * we ask -- once, right after the shot, while they are still looking at it.
 *
 * The division of labour is the whole idea:
 *
 *   mass = volume x density
 *          ^^^^^^   ^^^^^^^
 *          user     model
 *
 * Nobody can name a portion in grams -- ask for a number and you collect round
 * guesses that then drag the estimate with them. But anyone can see how much of
 * the plate is covered, how full the bowl is, or how many pancakes are stacked.
 * The model, meanwhile, knows that cooked rice is 130 kcal/100 g and chicken
 * breast 110, which no user does. So the user describes the SHAPE and the model
 * supplies the density.
 *
 * Mechanically that reduces to one number from the model per meal: the mass of
 * ONE unit of whatever it recognised (`jedinica_grami` -- a full plate of this
 * food, a full bowl of it, or one piece of it). The dial then just multiplies.
 */

/**
 * Which shape the food has, and therefore which question is worth asking.
 * The model picks this from the first photo; it is what makes the dial fit the
 * food instead of forcing every meal through the same mound.
 */
export const VESSELS = ["ravan", "dubok", "komadi"] as const;
export type Vessel = (typeof VESSELS)[number];

export function isVessel(value: unknown): value is Vessel {
  return typeof value === "string" && VESSELS.includes(value as Vessel);
}

/**
 * How high the food is piled, for the flat-plate case. Fingers rather than
 * centimetres on purpose: everybody has the ruler with them and nobody
 * estimates "1.5 cm" of rice correctly.
 */
export const HEIGHT_LEVELS = ["tanko", "prst", "dva_prsta"] as const;
export type HeightLevel = (typeof HEIGHT_LEVELS)[number];

export const HEIGHT_LABELS: Record<HeightLevel, string> = {
  tanko: "Tanak sloj",
  prst: "Oko prsta",
  dva_prsta: "Dva prsta i više",
};

/** Multiplier against the reference layer, which `prst` defines as 1. */
const HEIGHT_FACTOR: Record<HeightLevel, number> = {
  tanko: 0.55,
  prst: 1,
  dva_prsta: 1.75,
};

const HEIGHT_PROMPT: Record<HeightLevel, string> = {
  tanko: "u tankom sloju (jedva pokriva dno)",
  prst: "u sloju debljine otprilike jednog prsta (~1,5 cm)",
  dva_prsta: "nagomilano, debljine dva prsta i više (~3 cm)",
};

/** What the user actually dragged. One shape per vessel. */
export type PortionGeometry =
  | { vessel: "ravan"; coverage: number; height: HeightLevel }
  | { vessel: "dubok"; level: number }
  | { vessel: "komadi"; count: number };

export const COVERAGE_MIN = 0.2;
export const COVERAGE_MAX = 1;
export const LEVEL_MIN = 0.15;
export const LEVEL_MAX = 1;
export const COUNT_MIN = 1;
export const COUNT_MAX = 12;

export function defaultGeometry(vessel: Vessel): PortionGeometry {
  if (vessel === "dubok") return { vessel: "dubok", level: 0.7 };
  if (vessel === "komadi") return { vessel: "komadi", count: 2 };
  return { vessel: "ravan", coverage: 0.7, height: "prst" };
}

/**
 * The model's mass anchor for the food it recognised: one full plate of it, one
 * full bowl of it, or one piece of it. This is the only nutrition number the
 * dial needs, and it is the one thing the model knows better than the user.
 */
export interface PortionUnit {
  /** Shown to the user, e.g. "pun tanjir pirinča" or "palačinka". */
  naziv: string;
  grami: number;
}

/** Plausible range for a unit mass, per vessel. Guards against a model that
 * answers 5000 for one pancake and takes the whole estimate with it. */
const UNIT_BOUNDS: Record<Vessel, { min: number; max: number }> = {
  ravan: { min: 120, max: 900 },
  dubok: { min: 120, max: 1200 },
  komadi: { min: 5, max: 600 },
};

/** What we fall back to when the model gives us nothing usable. Deliberately
 * ordinary: a normal plate of normal food. */
const UNIT_FALLBACK: Record<Vessel, PortionUnit> = {
  ravan: { naziv: "pun tanjir", grami: 350 },
  dubok: { naziv: "puna posuda", grami: 400 },
  komadi: { naziv: "komad", grami: 80 },
};

export function normaliseUnit(
  vessel: Vessel,
  naziv: unknown,
  grami: unknown
): PortionUnit {
  const bounds = UNIT_BOUNDS[vessel];
  const n = Number(grami);
  const fallback = UNIT_FALLBACK[vessel];
  return {
    naziv:
      typeof naziv === "string" && naziv.trim().length > 0
        ? naziv.trim().slice(0, 60)
        : fallback.naziv,
    grami:
      Number.isFinite(n) && n > 0
        ? Math.min(Math.max(Math.round(n), bounds.min), bounds.max)
        : fallback.grami,
  };
}

/** Geometry x the model's unit mass. The number the user watches while dragging. */
export function portionGrams(
  geometry: PortionGeometry,
  unit: PortionUnit
): number {
  let raw: number;
  if (geometry.vessel === "dubok") {
    raw = unit.grami * geometry.level;
  } else if (geometry.vessel === "komadi") {
    raw = unit.grami * geometry.count;
  } else {
    raw = unit.grami * geometry.coverage * HEIGHT_FACTOR[geometry.height];
  }
  // Round to 5 g: the input is a human eyeballing a plate, and a figure like
  // "347 g" would claim a precision the whole method does not have.
  return Math.min(Math.max(Math.round(raw / 5) * 5, 10), 3000);
}

/** Plain-language read-out beside the grams, so the number is never alone. */
export function geometryHint(geometry: PortionGeometry, unit: PortionUnit): string {
  if (geometry.vessel === "dubok") {
    const pct = Math.round(geometry.level * 100);
    if (pct >= 95) return "puna posuda";
    if (pct >= 70) return "skoro puna posuda";
    if (pct >= 45) return "do pola";
    return "malo, na dnu";
  }
  if (geometry.vessel === "komadi") {
    return geometry.count === 1 ? `1 × ${unit.naziv}` : `${geometry.count} × ${unit.naziv}`;
  }
  const pct = Math.round(geometry.coverage * 100);
  const spread =
    pct >= 95 ? "ceo tanjir" : pct >= 70 ? "veći deo tanjira" : pct >= 45 ? "pola tanjira" : "manji deo tanjira";
  return `${spread} · ${HEIGHT_LABELS[geometry.height].toLowerCase()}`;
}

/**
 * How it was cooked. The second half of the step and the cheaper half to
 * answer: one tap, and at the margins it moves the estimate more than the mass
 * does. A tablespoon of oil is 126 kcal and visually almost invisible;
 * breaded-and-fried is +30-40% over the same food grilled. No photo shows that.
 */
export const PREP_METHODS = ["kuvano", "bez_ulja", "malo_ulja", "przeno"] as const;
export type PrepMethod = (typeof PREP_METHODS)[number];

/**
 * Chip labels. The OIL leads and the cooking method follows in brackets --
 * because the amount of fat is what the choice actually controls, while the
 * method is only how you recognise your own meal.
 *
 * Before, the four labels mixed two vocabularies: two named a method
 * ("Kuvano / na pari", "Prženo / pohovano") and two named an amount of oil, so
 * picking meant translating between the two axes. Leading with the oil makes
 * the last three read as one scale -- bez → malo → puno -- which is the scale
 * the calories actually follow.
 *
 * "Na malo ulja" keeps deep-frying in a little oil covered (8-12 g vs the
 * 15-25 g below), so the split is a real one, not a wording nicety.
 */
export const PREP_LABELS: Record<PrepMethod, string> = {
  kuvano: "Kuvano / na pari",
  bez_ulja: "Pečeno bez ulja",
  malo_ulja: "Na malo ulja",
  przeno: "Puno ulja (prženo/pohovano)",
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

/**
 * What FINALIZE is told when the cooking chips were never shown -- because the
 * ANALYZE step judged that nobody cooked this food (an ice cream, a yoghurt, a
 * piece of fruit, a packaged snack).
 *
 * Saying nothing at all would be worse than saying this: the finalize prompt
 * instructs the model to itemise cooking fat as its own component, so an
 * unanswered prep slot invites it to invent a spoonful of oil under a scoop of
 * ice cream. The line kills the invention without touching the fat that is
 * genuinely inside the product.
 */
const NO_PREP_HINT =
  "Priprema nije ni pitana: ovo je hrana koju niko nije spremao na šporetu (gotov/industrijski proizvod, sirovo, piće ili poslastica). NE dodaj ulje ni mast iz pripreme kao komponentu — uzmi vrednosti kakve taj proizvod ima sam po sebi (mast koja je u receptu, npr. u sladoledu ili čokoladi, naravno ostaje).";

export function isPrepMethod(value: unknown): value is PrepMethod {
  return typeof value === "string" && PREP_METHODS.includes(value as PrepMethod);
}

/** How the user described the shape, in words the model can act on. */
function describeGeometry(geometry: PortionGeometry, unit: PortionUnit): string {
  if (geometry.vessel === "dubok") {
    return `Posuda je duboka i napunjena je otprilike ${Math.round(
      geometry.level * 100
    )}% do vrha.`;
  }
  if (geometry.vessel === "komadi") {
    return `Pojedeno je ${geometry.count} × ${unit.naziv}.`;
  }
  return `Hrana pokriva otprilike ${Math.round(
    geometry.coverage * 100
  )}% površine tanjira, ${HEIGHT_PROMPT[geometry.height]}.`;
}

/**
 * The block of prompt text both Prizma calls receive.
 *
 * The tolerance band is stated outright rather than left implicit, because the
 * failure mode we care about is the model treating a rough human reading as a
 * measurement. It also tells the model NOT to spend one of its at most three
 * questions re-asking what was just answered -- which is the real win of the
 * step: it doesn't add a question, it trades a weak one for a strong one.
 */
export function describePortion(
  geometry: PortionGeometry | null,
  unit: PortionUnit | null,
  prep: PrepMethod | null
): string {
  if (geometry == null && prep == null) return "";

  const lines: string[] = ["KORISNIK JE VEĆ ODGOVORIO (stojeći nad tanjirom):"];

  if (geometry != null && unit != null) {
    const grams = portionGrams(geometry, unit);
    const low = Math.round((grams * 0.7) / 5) * 5;
    const high = Math.round((grams * 1.3) / 5) * 5;
    lines.push(
      `- ${describeGeometry(geometry, unit)}`,
      `  Iz toga sledi ukupna masa OTPRILIKE ${grams} g.`,
      `  To je opis oblika koji je korisnik video, ne merenje. Uzmi ga kao POLAZNU RAZMERU i drži se opsega ${low}–${high} g.`,
      "  Izađi iz opsega samo ako slike to jasno pokazuju; ako izađeš, obrazloži u „napomena”."
    );
  }

  lines.push(prep != null ? `- ${PREP_HINTS[prep]}` : `- ${NO_PREP_HINT}`);

  lines.push(
    "NE PITAJ ponovo ni koliko je pojedeno ni kako je pripremljeno — to je već odgovoreno.",
    "Pitanja troši na ono što i dalje ne znaš (koji sastojak, šta je ispod, ima li sosa/dresinga)."
  );

  return lines.join("\n");
}
