import { z } from "zod";

import {
  CONFIDENCE_VALUES,
  mealEstimateSchema,
  type MealEstimate,
} from "@/lib/ai/meal-estimate";

// iPeach mtd v3 — the highest-accuracy path, built around one idea: a photo
// cannot weigh food, so stop pretending it can and go get the missing facts.
//
// Three things carry the accuracy, in order of how much they matter:
//
//  1. TWO FIXED ANGLES. Top-down gives width, a 45° shot gives height. Neither
//     alone bounds volume; together they do. The UI guides the user into both.
//  2. A REFERENCE OBJECT. The real blocker is metric scale -- the model cannot
//     tell a 20 cm plate from a 30 cm one. A fork is ~19-20 cm and standardised
//     across Europe, so laying one beside the plate gives the same anchor a
//     depth sensor would, for free.
//  3. QUESTIONS DERIVED FROM DOUBT. The model first inventories what it sees
//     with per-item confidence and a kcal-at-stake figure, and questions are
//     generated only for the items it is unsure about, ordered by how much
//     they move the number. That is what keeps "Koliko si pojeo?" from firing
//     when two angles already answer it.
//
// Step 2 (FINALIZE) then returns an itemised breakdown, which `reconcile.ts`
// checks arithmetically and the result screen shows to the user.

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
      "Slika 2 je snimljena POD UGLOM ~45° (vidi se VISINA/debljina porcije)."
    );
    if (count > 2) {
      lines.push(`Ostale slike (${count - 2}) su dodatni uglovi istog obroka.`);
    }
    lines.push(
      "Spoji širinu sa prve i visinu sa druge slike da proceniš ZAPREMINU, pa iz zapremine masu."
    );
  } else {
    lines.push(
      "Dostupna je SAMO JEDNA slika (korisnik nije snimio drugi ugao), pa se visina/debljina porcije ne vidi pouzdano. Budi oprezniji sa masom i snizi sigurnost."
    );
  }
  lines.push(REFERENCE_HINTS[reference]);
  return lines.join("\n");
}

/** One clarifying question. `opcije` are the tappable answers; `zasto` is what
 * the model could not tell from the photo (shown to the user, so the question
 * visibly comes from THEIR plate); `uticaj_kcal` is how much the answer moves
 * the estimate, which is how we rank and cut to the top three. */
export const ipeachQuestionSchema = z.object({
  pitanje: z.string().trim().min(1).max(200),
  opcije: z.array(z.string().trim().min(1).max(80)).min(2).max(5),
  zasto: z.string().trim().max(160).catch("").default(""),
  uticaj_kcal: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 2000) : 0)),
  vise_odgovora: z.coerce.boolean().catch(false).default(false),
});
export type IPeachQuestion = z.infer<typeof ipeachQuestionSchema>;

/** Analysis outcome: EITHER clarifying questions OR (already confident) a final
 * estimate in the shared meal shape. */
export type IPeachAnalysis =
  | { status: "pitanja"; pitanja: IPeachQuestion[] }
  | { status: "procena"; estimate: MealEstimate };

export type IPeachVariant = "obrok" | "deklaracija";

/** Last-resort question when the model gives us neither a usable estimate nor a
 * usable question. Generic by definition -- but it only ever fires on a
 * malformed response, so the flow degrades instead of dead-ending. */
function defaultPortionQuestion(variant: IPeachVariant): IPeachQuestion {
  return variant === "deklaracija"
    ? {
        pitanje: "Koliko si pojeo?",
        opcije: ["Ceo proizvod", "Otprilike pola", "Trećinu", "Dve kašike"],
        zasto: "",
        uticaj_kcal: 0,
        vise_odgovora: false,
      }
    : {
        pitanje: "Koliko si pojeo?",
        opcije: ["Sve", "Otprilike pola", "Manje od pola", "Više od pola"],
        zasto: "",
        uticaj_kcal: 0,
        vise_odgovora: false,
      };
}

/**
 * Defensively turn Gemini's raw analysis JSON into a typed `IPeachAnalysis`.
 * Never throws: a malformed estimate falls through to questions, malformed
 * questions are dropped, and if nothing usable is left we ask the one thing we
 * always need (the eaten amount), so the flow can never dead-end.
 *
 * Surviving questions are ordered by kcal at stake and cut to `MAX_QUESTIONS`,
 * so when the model over-asks the user still only sees what actually matters.
 */
export function parseIPeachAnalysis(
  raw: unknown,
  variant: IPeachVariant
): IPeachAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;

  if (obj.status === "procena") {
    const est = mealEstimateSchema.safeParse(obj);
    // `mealEstimateSchema` is all-`.catch()`, so it succeeds on nearly any
    // input -- an empty "procena" would parse into a 0 kcal / 1 g meal and be
    // logged as fact. Require the estimate to actually say something before we
    // skip the questions.
    if (est.success && est.data.kcal > 0 && est.data.procenjeni_grami > 1) {
      return { status: "procena", estimate: est.data };
    }
    // Otherwise fall through and ask rather than return a hollow number.
  }

  // Parse question-by-question: one malformed entry must not take the usable
  // ones down with it (which `z.array(...).safeParse` would do).
  const rawList = Array.isArray(obj.pitanja) ? obj.pitanja : [];
  const pitanja = rawList
    .map((q) => ipeachQuestionSchema.safeParse(q))
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((q) => q.opcije.length >= 2)
    .sort((a, b) => b.uticaj_kcal - a.uticaj_kcal)
    .slice(0, MAX_QUESTIONS);

  if (pitanja.length === 0) {
    return { status: "pitanja", pitanja: [defaultPortionQuestion(variant)] };
  }
  return { status: "pitanja", pitanja };
}

// The JSON schema for the ANALYSIS call. `vidim` comes FIRST in
// `propertyOrdering` on purpose: the model must inventory the plate item by
// item, with its own confidence per item, before it is allowed to write
// questions or an estimate. Questions then fall out of the low-confidence
// items instead of being pulled from a template.
export const IPEACH_ANALYZE_RESPONSE_SCHEMA = {
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
    status: { type: "STRING", enum: ["pitanja", "procena"] },
    pitanja: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          pitanje: { type: "STRING" },
          opcije: { type: "ARRAY", items: { type: "STRING" } },
          zasto: { type: "STRING" },
          uticaj_kcal: { type: "NUMBER" },
          vise_odgovora: { type: "BOOLEAN" },
        },
        required: ["pitanje", "opcije", "zasto", "uticaj_kcal"],
        propertyOrdering: [
          "pitanje",
          "opcije",
          "zasto",
          "uticaj_kcal",
          "vise_odgovora",
        ],
      },
    },
    naziv: { type: "STRING" },
    sastojci: { type: "ARRAY", items: { type: "STRING" } },
    procenjeni_grami: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    uh_g: { type: "NUMBER" },
    mast_g: { type: "NUMBER" },
    sigurnost: { type: "STRING", enum: [...CONFIDENCE_VALUES] },
    napomena: { type: "STRING" },
  },
  required: ["vidim", "status"],
  propertyOrdering: [
    "vidim",
    "status",
    "pitanja",
    "naziv",
    "sastojci",
    "procenjeni_grami",
    "kcal",
    "protein_g",
    "uh_g",
    "mast_g",
    "sigurnost",
    "napomena",
  ],
} as const;

// The FINALIZE schema. This one is iPeach-only (the shared
// `MEAL_RESPONSE_SCHEMA` stays untouched, so the plain "Slikaj obrok" flow is
// unaffected) and its whole point is `komponente` sitting BEFORE the totals in
// `propertyOrdering`: the model itemises, then sums, instead of leaping to a
// round number. `reconcile.ts` then verifies that sum arithmetically.
export const IPEACH_FINALIZE_RESPONSE_SCHEMA = {
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
    "sigurnost",
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

export const IPEACH_ANALYZE_PROMPT = `Ti si iskusan nutricionista koji procenjuje obroke sa fotografija.

KORAK 1 — POPIŠI ŠTA VIDIŠ.
U "vidim" navedi svaku komponentu obroka posebno, i za SVAKU odredi svoju sigurnost:
- "visoka" = jasno vidiš i šta je i koliko ga ima
- "srednja" = znaš šta je, ali ti količina ili priprema nije sigurna
- "niska" = ne razaznaješ šta je, ili ti ključan podatak nedostaje
U "nejasno" napiši KONKRETNO šta te koči kod te stavke (npr. "ne vidim dno tanjira ispod mesa", "ne razaznajem je li pohovano ili grilovano"). Ostavi prazno kad je stavka jasna.

KORAK 2 — PITAJ SAMO ONO ŠTO SI SAM OZNAČIO KAO NEJASNO.
Pitanja izvedi ISKLJUČIVO iz stavki sa "srednja"/"niska" sigurnošću. Najviše ${MAX_QUESTIONS}.
- STROGO ZABRANJENO: pitanje na koje slike već odgovaraju. Ako se sa dva ugla vidi koliko je hrane, NE pitaj koliko je pojedeno.
- STROGO ZABRANJENO: opšta pitanja po šablonu ("Šta si jeo?", "Da li je zdravo?").
- Svako pitanje mora da menja procenu za bar 40 kcal. U "uticaj_kcal" napiši koliko kcal otprilike visi o tom odgovoru (razlika između najskuplje i najjeftinije opcije).
- U "zasto" napiši kratko šta tačno na slici ne možeš da razaznaš. To se prikazuje korisniku.
- "opcije": 2–4 konkretna, kratka odgovora (npr. "Grilovano", "Na ulju", "Pohovano", "U rerni"). NE dodaj "Ne znam" ni "Nešto drugo" — to dodaje aplikacija.
- "vise_odgovora": true samo kad više odgovora može da važi istovremeno (npr. koji sve prilozi).
- Pitanja i opcije na srpskom (latinica).
Vrati "status": "pitanja".

KORAK 3 — ILI PROCENI ODMAH.
Ako su SVE stavke u "vidim" sigurnosti "visoka", preskoči pitanja: vrati "status": "procena" i popuni polja procene (UKUPNO za pojedenu porciju, ne na 100 g).

${NUTRITION_ANCHORS}

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const IPEACH_ANALYZE_LABEL_PROMPT = `Dobijaš 1–5 FOTOGRAFIJA nutritivne DEKLARACIJE (tabele) proizvoda, po potrebi i sam proizvod/pakovanje.

KORAK 1 — POPIŠI ŠTA VIDIŠ.
U "vidim" navedi šta si očitao (npr. "kcal na 100 g", "ukupna masa pakovanja") sa sigurnošću za svaku stavku, i u "nejasno" šta ne možeš da pročitaš.

KORAK 2 — PITAJ ONO ŠTO FALI.
Sa deklaracije čitaš vrednosti na 100 g, ali ti gotovo uvek fali KOLIKO je proizvod ukupno težak i KOLIKO je pojedeno. Postavi najviše ${MAX_QUESTIONS} kratka pitanja sa 2–4 ponuđena odgovora.
- U "uticaj_kcal" napiši koliko kcal visi o odgovoru; u "zasto" šta ti nedostaje.
- NE dodaj "Ne znam" ni "Nešto drugo" u opcije — to dodaje aplikacija.
- Pitanja i opcije na srpskom (latinica).
Vrati "status": "pitanja".

KORAK 3 — ILI PROCENI ODMAH.
Ako se i ukupna masa i pojedena količina jasno vide — vrati "status": "procena" sa poljima procene (UKUPNO za pojedenu porciju, skalirano sa vrednosti na 100 g).

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

// --- FINALIZE prompts (step 2) --------------------------------------------

export const IPEACH_FINALIZE_PROMPT = `Ti si iskusan nutricionista. Dobijaš FOTOGRAFIJE obroka i korisnikove ODGOVORE na tvoja pitanja (tekst i/ili glasovni snimak).

Zadatak: proceni nutritivne vrednosti ZA POJEDENU porciju.

POSTUPAK — obavezno ovim redom:
1. Razloži obrok na KOMPONENTE (meso, prilog, salata, hleb, ulje/sos posebno kao svoju stavku).
2. Za svaku komponentu odredi masu u gramima, pa iz referentnih vrednosti izračunaj kcal i makroe.
3. Ulje/mast iz pripreme UVEK ide kao zasebna komponenta (npr. "ulje za prženje — 12 g"), nikad utopljena u drugu stavku.
4. Tek onda saberi komponente u ukupne vrednosti. Ukupno MORA biti zbir komponenti.

Kako da čitaš izvore:
- Slike govore ŠTA je na tanjiru i koliko ga ima (širina sa prve, visina sa druge).
- Korisnikovi odgovori nose ono što se sa slike ne vidi (priprema, mast, sastav) — njima veruj iznad svoje pretpostavke.
- Ako je korisnik odgovorio "${DONT_KNOW_LABEL}", uzmi NAJVEROVATNIJU varijantu za takav obrok kod nas i spusti "sigurnost".
- Ako se slike i odgovori kose, veruj odgovorima i to kratko spomeni u "napomena".

${NUTRITION_ANCHORS}

Pravila za izlaz:
- "naziv": srpski (latinica), kratko i konkretno.
- "komponente": svaka sa nazivom, gramima, kcal i makroima. 2–8 stavki.
- "procenjeni_grami": ukupna POJEDENA masa (zbir grama komponenti).
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO (zbir komponenti), ne na 100 g.
- Proveri: 4×protein + 4×uh + 9×mast mora da odgovara kcal (±10%).
- "sigurnost": "visoka" samo kad su oba ugla snimljena, referenca jasna i odgovori potpuni.
- "napomena": kratko objasni ključne pretpostavke.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const IPEACH_FINALIZE_LABEL_PROMPT = `Dobijaš FOTOGRAFIJE nutritivne deklaracije i korisnikove ODGOVORE (tekst i/ili glasovni snimak) o ukupnoj masi proizvoda i pojedenoj količini.

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
- "sigurnost": "visoka" kad su i deklaracija i količina jasni; inače niže.
- "napomena": kratko (npr. "125 g od 250 g paketa").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
