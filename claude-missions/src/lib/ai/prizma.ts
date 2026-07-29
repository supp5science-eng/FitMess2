import { z } from "zod";

import { CONFIDENCE_VALUES, MICRO_PROMPT_RULES } from "@/lib/ai/meal-estimate";
import {
  isVessel,
  normaliseUnit,
  type PortionUnit,
  type Vessel,
} from "@/lib/ai/portion";

// Prizma v5 — the highest-accuracy path, built around one idea: a photo cannot
// weigh food, so stop pretending it can and go get the missing facts from the
// only party who has them.
//
// The split of labour is the whole design:
//
//   ANALYZE  (1 photo)  -- the model RECOGNISES: what food, what shape of
//                          vessel, what one unit of it weighs, and what it is
//                          still unsure about. It does not estimate anything.
//   the user            -- describes the SHAPE (how much of the plate, how
//                          full the bowl, how many pieces) and the cooking
//                          method, and answers the model's own questions.
//   FINALIZE (same photo + answers) -- does the arithmetic and itemises.
//
// Three things carry the accuracy:
//
//  1. GEOMETRY FROM THE USER, DENSITY FROM THE MODEL. Nobody can name a portion
//     in grams; everybody can see that the rice covers half the plate. The
//     model supplies what a full plate of THIS food weighs, and the dial
//     multiplies. That replaces the old mandatory 45° shot, which existed only
//     to bound height -- the same variable the dial now asks about directly,
//     at a fraction of the drop-off.
//  2. A REFERENCE OBJECT. The remaining blocker is metric scale -- the model
//     cannot tell a 20 cm plate from a 30 cm one. A fork is ~19-20 cm and
//     standardised across Europe, so laying one beside the plate gives the same
//     anchor a depth sensor would, for free.
//  3. QUESTIONS DERIVED FROM DOUBT. The model inventories what it sees with
//     per-item confidence, and questions are generated only for the items it is
//     unsure about, ranked by kcal at stake. Portion and preparation are struck
//     from that list because the dial already answered them -- so the slots go
//     to what is genuinely unknown.
//
// A second angle is still available, but only when the model says it would
// change the answer (something hidden under the food, an opaque sauce). It is
// one of its questions now, not a step everyone pays for.

/** What the user laid beside the plate, so the model knows the exact size of
 * its scale anchor instead of guessing what the object is. */
export const REFERENCE_OBJECTS = ["viljuska", "kasika", "kartica", "nista"] as const;
export type ReferenceObject = (typeof REFERENCE_OBJECTS)[number];

const REFERENCE_HINTS: Record<ReferenceObject, string> = {
  viljuska:
    "Pored tanjira je VILJUŠKA (standardna kašikara, dužina ~19–20 cm). Koristi je kao mernu referencu za veličinu tanjira i porcije.",
  kasika:
    "Pored tanjira je KAŠIKA (supena, dužina ~19 cm). Koristi je kao mernu referencu za veličinu tanjira i porcije.",
  kartica:
    "Pored tanjira je BANKOVNA KARTICA (85,6 × 54 mm). Koristi je kao mernu referencu za veličinu tanjira i porcije.",
  nista:
    "Nema referentnog objekta na slici. Proceni razmeru po tanjiru/priboru (standardni plitki tanjir ≈ 26 cm, duboki ≈ 22 cm) i zbog toga budi oprezniji sa masom.",
};

/** The always-available escape hatch on every question. Kept here so the prompt
 * can tell the model NOT to spend one of its options on it -- the UI appends
 * it. A user stuck on a question they genuinely can't answer abandons the flow. */
export const DONT_KNOW_LABEL = "Ne znam";
export const OTHER_LABEL = "Nešto drugo";

/** Hard cap. Three is the most a person answers without it feeling like an
 * interrogation, and past the top three the kcal at stake is usually noise. */
export const MAX_QUESTIONS = 3;

/**
 * Describe the photo set to the model. The capture flow is fixed (shot 1 is
 * top-down, shot 2 is at 45°), so we can state it outright rather than making
 * the model infer viewpoint -- which is exactly what it needs to combine width
 * and height into a volume.
 */
export function describeShots(count: number, reference: ReferenceObject): string {
  const lines: string[] = [];
  if (count >= 2) {
    lines.push(
      "Slika 1 je snimljena PRAVO ODOZGO (vidi se površina i širina porcije).",
      "Slika 2 je snimljena POD UGLOM (vidi se VISINA/debljina porcije i šta je ispod)."
    );
    if (count > 2) {
      lines.push(`Ostale slike (${count - 2}) su dodatni uglovi istog obroka.`);
    }
    lines.push(
      "Spoji širinu sa prve i visinu sa druge slike da proveriš zapreminu."
    );
  } else {
    // One photo is the normal case now, not a degraded one: the height that the
    // 45° shot used to carry arrives from the user's own description of the
    // shape. Saying "you are missing an angle, lower your confidence" here
    // would make the model hedge against information it actually has.
    lines.push(
      "Snimljena je JEDNA slika, PRAVO ODOZGO (vidi se površina i širina porcije).",
      "Visinu/debljinu porcije ne vidiš sa nje — nju ti daje korisnikov opis oblika (niže u poruci). Njemu veruj za količinu."
    );
  }
  lines.push(REFERENCE_HINTS[reference]);
  return lines.join("\n");
}

/** One clarifying question. `opcije` are the tappable answers; `zasto` is what
 * the model could not tell from the photo (shown to the user, so the question
 * visibly comes from THEIR plate); `uticaj_kcal` is how much the answer moves
 * the estimate, which is how we rank and cut to the top three; `stavka` names
 * the item from `vidim` the question is about, which is what lets us VERIFY the
 * question was derived from doubt rather than pulled from a template. */
export const prizmaQuestionSchema = z.object({
  stavka: z.string().trim().max(80).catch("").default(""),
  pitanje: z.string().trim().min(1).max(200),
  opcije: z.array(z.string().trim().min(1).max(80)).min(2).max(5),
  zasto: z.string().trim().max(160).catch("").default(""),
  uticaj_kcal: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 2000) : 0)),
  vise_odgovora: z.coerce.boolean().catch(false).default(false),
});
export type PrizmaQuestion = z.infer<typeof prizmaQuestionSchema>;

/** One line of the model's own inventory of the plate: what it thinks it sees,
 * how sure it is, and what specifically blocks it. */
export const prizmaSeenItemSchema = z.object({
  stavka: z.string().trim().min(1).max(80),
  sigurnost: z.enum(CONFIDENCE_VALUES).catch("srednja"),
  nejasno: z.string().trim().max(160).catch("").default(""),
});
export type PrizmaSeenItem = z.infer<typeof prizmaSeenItemSchema>;

/**
 * Where the questions the user ends up seeing actually came from. Logged
 * server-side (never shown), because "the questions feel generic" has three
 * very different causes and they are indistinguishable from the outside:
 *
 *  - `derived`    — bound to an item the model itself marked unclear. Working
 *                   as designed.
 *  - `unbound`    — the model asked about something it claimed to see clearly,
 *                   or about nothing in particular: a template question. We
 *                   keep only the single highest-impact one.
 *  - `unverified` — no inventory came back, so there was nothing to check
 *                   against; the questions pass through as before.
 *  - `none`       — no usable question at all. A legitimate outcome now: the
 *                   dial carries the portion, so a plate the model reads
 *                   cleanly needs nothing asked about it. (Before the dial this
 *                   had to degrade into a stock "Koliko si pojeo?", which is
 *                   exactly the generic-feeling question users complained about.)
 */
export type PrizmaQuestionSource =
  | "derived"
  | "unbound"
  | "unverified"
  | "none";

/**
 * What the ANALYZE call returns. Note what is NOT here: an estimate. This step
 * recognises and nothing else -- the arithmetic belongs to FINALIZE, after the
 * user has described the portion, and splitting the two is what stops the model
 * from committing to a mass before it has been told the shape.
 */
export interface PrizmaAnalysis {
  /** Best short name for the dish, used to label the dial. */
  naziv: string;
  /** Which dial the user should see, and what one unit of this food weighs. */
  posuda: Vessel;
  jedinica: PortionUnit;
  /**
   * The plate/bowl size the model measured, and whether it got there from the
   * reference object or just assumed a standard plate.
   *
   * MEASUREMENT ONLY — nothing computes from this yet. It exists because plate
   * size is the largest error source left in the whole method and it is
   * currently invisible: area goes with the square of the diameter, so a 22 cm
   * plate read as 30 cm inflates every coverage-based mass by ~85%, and neither
   * we nor the user would ever see it happen. Logging the number tells us
   * whether the fork is actually doing its job before we build a calibration
   * step for a problem that may already be solved.
   */
  razmera: { cm: number | null; poReferenci: boolean };
  /** Clarifying questions, ranked by kcal at stake. May legitimately be empty. */
  pitanja: PrizmaQuestion[];
  /** The model's own inventory of the plate (may be empty). */
  vidim: PrizmaSeenItem[];
  source: PrizmaQuestionSource;
  /**
   * Whether a second angle would actually change the answer -- something hidden
   * under the food, or a depth the top-down shot cannot bound. Asked for only
   * when true, because a photo everyone must take is the most expensive thing
   * in the flow and the dial already covers the common case.
   */
  ugao: { treba: boolean; zasto: string };
}

export type PrizmaVariant = "obrok" | "deklaracija";

/** Lowercase + strip Serbian diacritics, so "Pileće belo" matches "pilece belo". */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

/**
 * Does this question point at something the model itself said it was unsure of?
 *
 * The prompt has always ORDERED the model to ask only about unclear items, but
 * an order in a prompt is a request, not a constraint -- nothing stopped it
 * from filling in a confident inventory and then asking the same three template
 * questions anyway. This is the check that makes the rule real.
 *
 * Matching is deliberately loose (either string containing the other, accents
 * folded): the model writes "meso" in one field and "pileće meso" in the other
 * far too often for exact equality to be worth defending.
 */
function isDerivedFromDoubt(
  question: PrizmaQuestion,
  seen: PrizmaSeenItem[]
): boolean {
  const target = normalise(question.stavka);
  if (target.length < 2) return false;

  return seen.some((item) => {
    if (item.sigurnost === "visoka") return false;
    const name = normalise(item.stavka);
    if (name.length < 2) return false;
    return name.includes(target) || target.includes(name);
  });
}

/**
 * Defensively turn Gemini's raw analysis JSON into a typed `PrizmaAnalysis`.
 * Never throws: malformed questions are dropped one by one, a missing or absurd
 * unit mass falls back to an ordinary plate, and an empty question list is a
 * perfectly good result rather than a dead end.
 *
 * Surviving questions are ordered by kcal at stake and cut to `MAX_QUESTIONS`,
 * so when the model over-asks the user still only sees what actually matters.
 */
export function parsePrizmaAnalysis(
  raw: unknown,
  variant: PrizmaVariant
): PrizmaAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;

  // The model's inventory of the plate. Parsed per item for the same reason the
  // questions are: one bad line must not cost us the rest.
  const seen = (Array.isArray(obj.vidim) ? obj.vidim : [])
    .map((item) => prizmaSeenItemSchema.safeParse(item))
    .flatMap((result) => (result.success ? [result.data] : []));

  // A nutrition label has no shape to describe, so it always gets the simple
  // "how much of the package" dial.
  const posuda: Vessel =
    variant === "deklaracija"
      ? "ravan"
      : isVessel(obj.posuda)
        ? obj.posuda
        : "ravan";
  const jedinica = normaliseUnit(posuda, obj.jedinica_naziv, obj.jedinica_grami);

  const naziv =
    typeof obj.naziv === "string" && obj.naziv.trim()
      ? obj.naziv.trim().slice(0, 80)
      : "";

  // Bounded to sizes a plate or bowl can actually be, so one wild reading
  // cannot make the logs unreadable.
  const cmRaw = Number(obj.tanjir_cm);
  const razmera = {
    cm:
      Number.isFinite(cmRaw) && cmRaw >= 10 && cmRaw <= 45
        ? Math.round(cmRaw)
        : null,
    poReferenci: obj.razmera_po_referenci === true,
  };

  const ugao = {
    treba: obj.treba_ugao === true,
    zasto:
      typeof obj.ugao_zasto === "string" ? obj.ugao_zasto.trim().slice(0, 160) : "",
  };

  // Parse question-by-question: one malformed entry must not take the usable
  // ones down with it (which `z.array(...).safeParse` would do).
  const rawList = Array.isArray(obj.pitanja) ? obj.pitanja : [];
  const parsed = rawList
    .map((q) => prizmaQuestionSchema.safeParse(q))
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((q) => q.opcije.length >= 2)
    .sort((a, b) => b.uticaj_kcal - a.uticaj_kcal);

  const base = { naziv, posuda, jedinica, razmera, vidim: seen, ugao };

  // No question is a good outcome, not a failure: the dial already carries the
  // portion, so a plate the model reads cleanly has nothing left worth asking.
  if (parsed.length === 0) {
    return { ...base, pitanja: [], source: "none" };
  }

  // With no inventory there is nothing to check the questions against, so they
  // pass through -- a missing `vidim` is our blind spot, not the user's problem.
  if (seen.length === 0) {
    return {
      ...base,
      pitanja: parsed.slice(0, MAX_QUESTIONS),
      source: "unverified",
    };
  }

  const derived = parsed.filter((q) => isDerivedFromDoubt(q, seen));
  if (derived.length > 0) {
    return {
      ...base,
      pitanja: derived.slice(0, MAX_QUESTIONS),
      source: "derived",
    };
  }

  // The model inventoried the plate and then asked about none of it -- template
  // questions. Keep only the single most valuable one: asking three questions
  // that weren't earned is exactly the complaint we are fixing.
  return { ...base, pitanja: parsed.slice(0, 1), source: "unbound" };
}

// The JSON schema for the ANALYSIS call. `vidim` comes FIRST in
// `propertyOrdering` on purpose: the model must inventory the plate item by
// item, with its own confidence per item, before it is allowed to classify or
// to write questions. Questions then fall out of the low-confidence items
// instead of being pulled from a template, and the vessel/unit call is made
// with the food already named.
export const PRIZMA_ANALYZE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    vidim: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          stavka: { type: "STRING" },
          sigurnost: { type: "STRING", enum: [...CONFIDENCE_VALUES] },
          nejasno: { type: "STRING" },
        },
        required: ["stavka", "sigurnost"],
        propertyOrdering: ["stavka", "sigurnost", "nejasno"],
      },
    },
    naziv: { type: "STRING" },
    posuda: { type: "STRING", enum: ["ravan", "dubok", "komadi"] },
    // Measured BEFORE the unit mass in `propertyOrdering`: the model has to
    // commit to a plate size first, so the mass it then writes follows from a
    // stated measurement instead of the measurement being back-filled to
    // justify a round number.
    tanjir_cm: { type: "NUMBER" },
    razmera_po_referenci: { type: "BOOLEAN" },
    jedinica_naziv: { type: "STRING" },
    jedinica_grami: { type: "NUMBER" },
    pitanja: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          // `stavka` FIRST, mirroring the `vidim`-first trick one level up: the
          // model must name the item it is unsure about before it writes the
          // question, so the question follows from the doubt instead of the
          // doubt being back-filled to justify a template question.
          stavka: { type: "STRING" },
          pitanje: { type: "STRING" },
          opcije: { type: "ARRAY", items: { type: "STRING" } },
          zasto: { type: "STRING" },
          uticaj_kcal: { type: "NUMBER" },
          vise_odgovora: { type: "BOOLEAN" },
        },
        required: ["stavka", "pitanje", "opcije", "zasto", "uticaj_kcal"],
        propertyOrdering: [
          "stavka",
          "pitanje",
          "opcije",
          "zasto",
          "uticaj_kcal",
          "vise_odgovora",
        ],
      },
    },
    treba_ugao: { type: "BOOLEAN" },
    ugao_zasto: { type: "STRING" },
  },
  required: [
    "vidim",
    "naziv",
    "posuda",
    "tanjir_cm",
    "jedinica_naziv",
    "jedinica_grami",
  ],
  propertyOrdering: [
    "vidim",
    "naziv",
    "posuda",
    "tanjir_cm",
    "razmera_po_referenci",
    "jedinica_naziv",
    "jedinica_grami",
    "pitanja",
    "treba_ugao",
    "ugao_zasto",
  ],
} as const;

// The FINALIZE schema. This one is Prizma-only (the shared
// `MEAL_RESPONSE_SCHEMA` stays untouched, so the plain "Slikaj obrok" flow is
// unaffected) and its whole point is `komponente` sitting BEFORE the totals in
// `propertyOrdering`: the model itemises, then sums, instead of leaping to a
// round number. `reconcile.ts` then verifies that sum arithmetically.
export const PRIZMA_FINALIZE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    naziv: { type: "STRING" },
    sastojci: { type: "ARRAY", items: { type: "STRING" } },
    komponente: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          naziv: { type: "STRING" },
          grami: { type: "NUMBER" },
          kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          uh_g: { type: "NUMBER" },
          mast_g: { type: "NUMBER" },
        },
        required: ["naziv", "grami", "kcal", "protein_g", "uh_g", "mast_g"],
        propertyOrdering: [
          "naziv",
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
        ],
      },
    },
    procenjeni_grami: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    uh_g: { type: "NUMBER" },
    mast_g: { type: "NUMBER" },
    // The four micros the second home page runs on. They were missing here
    // while every other add-flow asked for them, which meant the app's most
    // accurate method was also the only one that logged NOTHING to the
    // micronutrient page -- a user who only used Prizma saw it permanently
    // empty.
    vlakna_g: { type: "NUMBER" },
    secer_g: { type: "NUMBER" },
    natrijum_mg: { type: "NUMBER" },
    zasicene_g: { type: "NUMBER" },
    sigurnost: { type: "STRING", enum: [...CONFIDENCE_VALUES] },
    napomena: { type: "STRING" },
  },
  required: [
    "naziv",
    "komponente",
    "procenjeni_grami",
    "kcal",
    "protein_g",
    "uh_g",
    "mast_g",
    "vlakna_g",
    "secer_g",
    "natrijum_mg",
    "zasicene_g",
    "sigurnost",
    // Required so the result always carries the AI's own short explanation of
    // how it reached the numbers -- the "it actually analysed, didn't copy a
    // template" signal the confirm screen surfaces.
    "napomena",
  ],
  propertyOrdering: [
    "naziv",
    "sastojci",
    "komponente",
    "procenjeni_grami",
    "kcal",
    "protein_g",
    "uh_g",
    "mast_g",
    "vlakna_g",
    "secer_g",
    "natrijum_mg",
    "zasicene_g",
    "sigurnost",
    "napomena",
  ],
} as const;

// --- Shared reference data -------------------------------------------------
// Hard numbers, not adjectives. "Realne balkanske porcije" tells the model
// nothing it can compute with; "kašika ulja = 14 g / 126 kcal" does. Fat is
// listed first because at 9 kcal/g it is where photo-based estimates go wrong:
// a tablespoon of oil is visually almost invisible and worth more calories
// than a slice of bread.
const NUTRITION_ANCHORS = `REFERENTNE VREDNOSTI (koristi ih, ne pogađaj):
Skrivena mast (najveći izvor greške):
- kašika ulja = 14 g = 126 kcal; kašika putera = 14 g = 100 kcal
- prženo u tiganju na ulju: +8–15 g masti po porciji
- pohovano (jaje + brašno + prezle): +30–40% kcal u odnosu na nepohovano
- pečeno u rerni na papiru / air fryer: +0–2 g masti
- majonez = 100 kcal/kašika; pavlaka = 30; jogurt dresing = 15; vinegret ≈ 60
Meso (na 100 g, kuvano/pečeno):
- pileće belo 110 · pileći batak 180 · junetina nemasna 180 · svinjski vrat 260 · mleveno mešano 240 · slanina 540
Prilozi (na 100 g, kuvano):
- pirinač 130 · testenina 150 · krompir kuvani 85 · pomfrit 310 · pire sa puterom 110 · pasulj 130 · hleb beli 265 · lepinja 270
Kućne mere:
- pun plitki tanjir jela ≈ 300–400 g · duboki tanjir čorbe ≈ 350 g
- velika (supena) kašika ≈ 15–20 g · šaka ≈ 30–40 g · šolja ≈ 240 ml
- kriška hleba ≈ 30 g · ćevap ≈ 25 g · kašika pirinča kuvanog ≈ 20 g`;

// --- ANALYSIS prompts (step 1) --------------------------------------------

export const PRIZMA_ANALYZE_PROMPT = `Ti si iskusan nutricionista. Dobijaš fotografiju obroka snimljenu ODOZGO.

TVOJ ZADATAK JE DA PREPOZNAŠ, NE DA PROCENIŠ.
Koliko je hrane reći će ti sam korisnik u sledećem koraku — on stoji nad tanjirom i vidi ono što ti ne vidiš. Ti mu spremaš alat kojim će to reći i pitaš ga samo ono što ni on ni slika još nisu rekli. NE računaj kalorije ovde.

KORAK 1 — POPIŠI ŠTA VIDIŠ.
U "vidim" navedi svaku komponentu obroka posebno, i za SVAKU odredi svoju sigurnost:
- "visoka" = jasno vidiš šta je
- "srednja" = znaš otprilike šta je, ali ti priprema ili sastav nisu sigurni
- "niska" = ne razaznaješ šta je
U "nejasno" napiši KONKRETNO šta te koči kod te stavke (npr. "ne vidim dno tanjira ispod mesa", "ne razaznajem je li pohovano ili grilovano"). Ostavi prazno kad je stavka jasna.
U "naziv" upiši kratak naziv celog jela na srpskom (npr. "Piletina sa pirinčem").

KORAK 2 — IZMERI POSUDU.
PRE nego što odrediš bilo kakvu masu, izmeri prečnik tanjira/posude i upiši ga u "tanjir_cm". Ovo je najveći izvor greške u celoj proceni: površina raste sa KVADRATOM prečnika, pa tanjir od 22 cm i tanjir od 30 cm nose skoro dvostruko različitu količinu hrane iako na slici izgledaju isto.
- Ako pored tanjira postoji referentni objekat (viljuška ~19–20 cm, kašika ~19 cm, kartica 8,56 cm), IZMERI po njemu i upiši "razmera_po_referenci": true.
- Ako referentnog objekta nema, uzmi standard (plitki tanjir ≈ 26 cm, duboki ≈ 22 cm, činija ≈ 16 cm) i upiši "razmera_po_referenci": false.
Vrednost mora biti u opsegu 10–45 cm.

KORAK 3 — ODREDI OBLIK ("posuda") I MASU JEDNE JEDINICE.
Ovo je najvažniji deo: od njega zavisi kako će korisnik moći da opiše količinu. Masu jedinice računaj za posudu koju si upravo izmerio, ne za neku prosečnu.
- "ravan" — hrana je raspoređena po ravnom tanjiru (meso sa prilogom, sarma, pečenje, salata). Korisnik će reći KOLIKI DEO TANJIRA je pokriven i KOLIKO JE VISOKO nagomilano.
  → "jedinica_naziv": "pun tanjir <hrane>"; "jedinica_grami": koliko bi GRAMA bilo kad bi CEO tanjir bio pokriven baš ovom hranom u sloju debljine jednog prsta (~1,5 cm). Za STANDARDNI tanjir od 26 cm to je 300–450 g za meso sa prilogom, 120–200 g za laganu salatu, 450–600 g za gusto pečenje — pa to skaliraj sa kvadratom odnosa prečnika (tanjir od 30 cm nosi ~33% više od tanjira od 26 cm, tanjir od 22 cm ~28% manje).
- "dubok" — hrana je u dubokoj posudi i meri se dubinom (čorba, supa, pasulj, gulaš, jogurt sa musli, sladoled u činiji). Korisnik će reći DOKLE JE NAPUNJENO.
  → "jedinica_naziv": "puna posuda"; "jedinica_grami": koliko GRAMA ove hrane staje u tu posudu kad je puna do vrha (duboki tanjir čorbe ≈ 350–400 g, veća činija ≈ 500–600 g).
- "komadi" — hrana se prirodno broji, a ne razmazuje (palačinke, pica parčad, sendvič, ćevapi, krofne, jaja, voće). Korisnik će reći KOLIKO KOMADA.
  → "jedinica_naziv": naziv JEDNOG komada u jednini ("palačinka", "parče pice", "ćevap"); "jedinica_grami": masa JEDNOG takvog komada (palačinka ≈ 60 g, parče pice ≈ 110 g, ćevap ≈ 25 g, jaje ≈ 60 g).
Kad se dvoumiš između "ravan" i "komadi": ako bi čovek prirodno rekao „pojeo sam tri", to je "komadi".

KORAK 4 — PITAJ SAMO ONO ŠTO SI SAM OZNAČIO KAO NEJASNO.
Pitanja izvedi ISKLJUČIVO iz stavki sa "srednja"/"niska" sigurnošću. Najviše ${MAX_QUESTIONS}. Nijedno pitanje nije sasvim u redu — prazna lista je ispravan odgovor kad je tanjir jasan.
- OBAVEZNO: u "stavka" upiši TAČAN naziv stavke iz "vidim" na koju se pitanje odnosi. Pitanje bez stavke iz "vidim" se odbacuje.
- STROGO ZABRANJENO: pitati KOLIKO je hrane, koliko je pojedeno, ili KAKO JE PRIPREMLJENO (na ulju/pohovano/kuvano). Korisnik na oba ta pitanja odgovara sam, u sledećem koraku. Ako ih ipak postaviš, samo si mu potrošio vreme.
- STROGO ZABRANJENO: opšta pitanja po šablonu ("Šta si jeo?", "Da li je zdravo?").
- IMENUJ hranu u pitanju: "Sos ispod mesa — pavlaka ili majonez?" je dobro, "Kakav je sos?" nije.
- Pitaj ono što ni slika ni gramaža ne rešavaju: koji je tačno sastojak (koje meso, koji sir), ima li nečega ISPOD ili UNUTRA, ima li dresinga/sosa/šećera koji se ne vidi.
- Svako pitanje mora da menja procenu za bar 40 kcal. U "uticaj_kcal" napiši koliko kcal otprilike visi o odgovoru (razlika između najskuplje i najjeftinije opcije).
- U "zasto" napiši kratko šta tačno na TOJ stavci ne možeš da razaznaš. To se prikazuje korisniku.
- "opcije": 2–4 konkretna kratka odgovora. NE dodaj "Ne znam" ni "Nešto drugo" — to dodaje aplikacija.
- "vise_odgovora": true samo kad više odgovora može da važi istovremeno.
- Pitanja i opcije na srpskom (latinica).

KORAK 5 — TREBA LI TI JOŠ JEDAN UGAO?
Postavi "treba_ugao": true SAMO ako postoji nešto što se odozgo fizički ne može videti, a jako menja procenu — npr. hrana je nagomilana pa ne vidiš šta je ispod, ili je posuda neprozirna pa ne znaš koliko je duboka. U "ugao_zasto" napiši to jednom rečenicom, korisniku ("Ne vidim šta je ispod mesa."). U svim ostalim slučajevima "treba_ugao": false — dodatna slika košta korisnika vremena i mnogi zbog nje odustanu.

${NUTRITION_ANCHORS}

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const PRIZMA_ANALYZE_LABEL_PROMPT = `Dobijaš 1–5 FOTOGRAFIJA nutritivne DEKLARACIJE (tabele) proizvoda, po potrebi i sam proizvod/pakovanje.

KORAK 1 — POPIŠI ŠTA VIDIŠ.
U "vidim" navedi šta si očitao (npr. "kcal na 100 g", "ukupna masa pakovanja") sa sigurnošću za svaku stavku, i u "nejasno" šta ne možeš da pročitaš.
U "naziv" upiši naziv proizvoda ako se vidi, inače kratak opis.

KORAK 2 — POPUNI OBAVEZNA POLJA OBLIKA.
Deklaracija nema oblik porcije, pa uvek vrati: "posuda": "ravan", "jedinica_naziv": "ceo proizvod", "jedinica_grami": ukupna masa pakovanja u gramima ako se vidi, inače 100. "tanjir_cm": 26, "razmera_po_referenci": false, "treba_ugao": false.

KORAK 3 — PITAJ ONO ŠTO FALI.
Sa deklaracije čitaš vrednosti na 100 g, ali ti gotovo uvek fali KOLIKO je proizvod ukupno težak i KOLIKO je pojedeno. Ovde je to dozvoljeno i poželjno pitati. Najviše ${MAX_QUESTIONS} kratka pitanja sa 2–4 ponuđena odgovora.
- OBAVEZNO: u "stavka" upiši naziv stavke iz "vidim" na koju se pitanje odnosi.
- U "uticaj_kcal" napiši koliko kcal visi o odgovoru; u "zasto" šta ti nedostaje.
- NE dodaj "Ne znam" ni "Nešto drugo" u opcije — to dodaje aplikacija.
- Pitanja i opcije na srpskom (latinica).

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

// --- FINALIZE prompts (step 2) --------------------------------------------

export const PRIZMA_FINALIZE_PROMPT = `Ti si iskusan nutricionista. Dobijaš FOTOGRAFIJE obroka i korisnikove ODGOVORE na tvoja pitanja (tekst i/ili glasovni snimak).

Zadatak: proceni nutritivne vrednosti ZA POJEDENU porciju.

POSTUPAK — obavezno ovim redom:
1. Razloži obrok na KOMPONENTE (meso, prilog, salata, hleb, ulje/sos posebno kao svoju stavku).
2. Za svaku komponentu odredi masu u gramima, pa iz referentnih vrednosti izračunaj kcal i makroe.
3. Ulje/mast iz pripreme UVEK ide kao zasebna komponenta (npr. "ulje za prženje — 12 g"), nikad utopljena u drugu stavku.
4. Tek onda saberi komponente u ukupne vrednosti. Ukupno MORA biti zbir komponenti.

Kako da čitaš izvore:
- Slika govori ŠTA je na tanjiru i kako je raspoređeno.
- KOLIKO ga ima govori korisnikov opis oblika (pokrivenost tanjira i visina sloja, napunjenost posude, ili broj komada) — to je tvoja glavna razmera za masu, jer korisnik stoji nad tanjirom i vidi ono što slika ne prenosi.
- Korisnikovi odgovori nose ono što se sa slike ne vidi (priprema, mast, sastav) — njima veruj iznad svoje pretpostavke.
- Ako je korisnik odgovorio "${DONT_KNOW_LABEL}", uzmi NAJVEROVATNIJU varijantu za takav obrok kod nas i spusti "sigurnost".
- Ako se slike i odgovori kose, veruj odgovorima i to kratko spomeni u "napomena".

${NUTRITION_ANCHORS}

Pravila za izlaz:
- "naziv": srpski (latinica), kratko i konkretno.
- "komponente": svaka sa nazivom, gramima, kcal i makroima. 2–8 stavki.
- "procenjeni_grami": ukupna POJEDENA masa (zbir grama komponenti).
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO (zbir komponenti), ne na 100 g.
${MICRO_PROMPT_RULES}
- Proveri: 4×protein + 4×uh + 9×mast mora da odgovara kcal (±10%).
- "sigurnost": "visoka" samo kad je hrana jasno prepoznata, referenca jasna i korisnikov opis oblika potpun; inače niže.
- "napomena": OBAVEZNO — napiši u 1–2 rečenice, prijateljski i konkretno za BAŠ OVAJ obrok, kako si došao do brojki: šta si prepoznao na tanjiru, koje si mase glavnih komponenti uzeo i koja pretpostavka najviše nosi kalorije (npr. „Vidim pola tanjira pirinča (~150 g) i pileće belo (~120 g); pošto deluje prženo, dodao sam kašiku ulja — otud najviše masti."). Piši kao da objašnjavaš čoveku svojim rečima, nikako šablonski ni prazno. Ovo je dokaz da si zaista analizirao, a ne prepisao.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const PRIZMA_FINALIZE_LABEL_PROMPT = `Dobijaš FOTOGRAFIJE nutritivne deklaracije i korisnikove ODGOVORE (tekst i/ili glasovni snimak) o ukupnoj masi proizvoda i pojedenoj količini.

Zadatak: izračunaj nutritivne vrednosti ZA POJEDENU količinu.
- Sa deklaracije pročitaj vrednosti na 100 g (ako je energija u kJ: kcal = kJ / 4.184).
- Iz odgovora odredi POJEDENU masu u gramima (ukupno × udeo, ili kućna mera → realni grami).
- Pomnoži vrednosti na 100 g sa (pojedeni_grami / 100) za UKUPNO.
- Ako je korisnik odgovorio "${DONT_KNOW_LABEL}", uzmi najverovatniju količinu i spusti "sigurnost".

Pravila:
- "naziv": naziv proizvoda ako se zna, inače kratko opisno (srpski, latinica).
- "sastojci": [] osim ako se jasno vide.
- "komponente": jedna stavka — sam proizvod sa pojedenom masom i vrednostima.
- "procenjeni_grami": POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju.
- Ako deklaracija navodi vlakna, šećere, so/natrijum ili zasićene masti, pročitaj ih sa tabele i skaliraj isto kao makroe; ako ih nema, proceni po vrsti proizvoda.
${MICRO_PROMPT_RULES}
- "sigurnost": "visoka" kad su i deklaracija i količina jasni; inače niže.
- "napomena": OBAVEZNO — u 1–2 rečenice objasni svojim rečima kako si izračunao: koju si pojedenu masu uzeo i sa kojih vrednosti sa deklaracije si je skalirao (npr. „Uzeo sam 125 g od paketa od 250 g i skalirao vrednosti sa deklaracije (na 100 g) na tu masu."). Neka se vidi da si zaista pročitao tabelu, a ne prepisao.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
