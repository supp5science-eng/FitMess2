import { z } from "zod";

import {
  CONFIDENCE_VALUES,
  mealEstimateSchema,
  type MealEstimate,
} from "@/lib/ai/meal-estimate";

// iPeach mtd v2 — the highest-accuracy path, now a short 2-step conversation:
//
//  1. ANALYZE: the user sends 1–5 photos of the same meal (more angles = a
//     better read). Gemini looks at them and either (a) already has enough to
//     estimate, or (b) asks a few short clarifying questions, each with tappable
//     suggested answers ("Meso — pohovano ili grilovano?"). Crucially it also
//     asks HOW MUCH was eaten when the photo can't tell — that's what makes the
//     portion (and therefore the calories) accurate.
//  2. FINALIZE: we send the same photos back with the user's answers (tapped
//     and/or spoken) and Gemini returns the final estimate in the SHARED meal
//     schema, so the confirm/edit/save screen and the `logs` write stay
//     identical to every other add flow.
//
// This file owns the question schema, the analysis response schema/prompt, the
// finalize prompts, and the defensive parse that turns Gemini's raw JSON into
// a typed `IPeachAnalysis` (never throws on a stray value).

/** One clarifying question. `opcije` are the tappable suggested answers (A/B/C…);
 * `vise_odgovora` marks a question where several options can apply at once
 * (e.g. "Šta sve ide uz meso?"). */
export const ipeachQuestionSchema = z.object({
  pitanje: z.string().trim().min(1).max(200),
  opcije: z.array(z.string().trim().min(1).max(80)).min(2).max(5),
  vise_odgovora: z.coerce.boolean().catch(false).default(false),
});
export type IPeachQuestion = z.infer<typeof ipeachQuestionSchema>;

/** Analysis outcome: EITHER clarifying questions OR (already confident) a final
 * estimate in the shared meal shape. */
export type IPeachAnalysis =
  | { status: "pitanja"; pitanja: IPeachQuestion[] }
  | { status: "procena"; estimate: MealEstimate };

export type IPeachVariant = "obrok" | "deklaracija";

/** The single question we always fall back to when the model gives us neither
 * a usable estimate nor a usable question — we still need the eaten amount. */
function defaultPortionQuestion(variant: IPeachVariant): IPeachQuestion {
  return variant === "deklaracija"
    ? {
        pitanje: "Koliko si pojeo?",
        opcije: ["Ceo proizvod", "Otprilike pola", "Trećinu", "Dve kašike"],
        vise_odgovora: false,
      }
    : {
        pitanje: "Koliko si pojeo?",
        opcije: ["Sve", "Otprilike pola", "Manje od pola", "Više od pola"],
        vise_odgovora: false,
      };
}

/**
 * Defensively turn Gemini's raw analysis JSON into a typed `IPeachAnalysis`.
 * Never throws: a malformed estimate falls through to questions, malformed
 * questions are dropped, and if nothing usable is left we ask the one thing we
 * always need (the eaten amount), so the flow can never dead-end.
 */
export function parseIPeachAnalysis(
  raw: unknown,
  variant: IPeachVariant
): IPeachAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;

  if (obj.status === "procena") {
    const est = mealEstimateSchema.safeParse(obj);
    if (est.success) return { status: "procena", estimate: est.data };
    // Malformed estimate — fall through and ask instead of returning garbage.
  }

  const parsed = z.array(ipeachQuestionSchema).safeParse(obj.pitanja);
  const pitanja = (parsed.success ? parsed.data : [])
    .filter((q) => q.opcije.length >= 2)
    .slice(0, 4);

  if (pitanja.length === 0) {
    return { status: "pitanja", pitanja: [defaultPortionQuestion(variant)] };
  }
  return { status: "pitanja", pitanja };
}

// The JSON schema we constrain the ANALYSIS call to. `status` is the only
// required field; the estimate fields are only filled when status='procena',
// the questions only when status='pitanja'.
export const IPEACH_ANALYZE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["pitanja", "procena"] },
    pitanja: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          pitanje: { type: "STRING" },
          opcije: { type: "ARRAY", items: { type: "STRING" } },
          vise_odgovora: { type: "BOOLEAN" },
        },
        required: ["pitanje", "opcije"],
        propertyOrdering: ["pitanje", "opcije", "vise_odgovora"],
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
  required: ["status"],
  propertyOrdering: [
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

// --- ANALYSIS prompts (step 1) --------------------------------------------

export const IPEACH_ANALYZE_PROMPT = `Dobijaš 1–5 FOTOGRAFIJA ISTOG obroka, iz različitih uglova (npr. odozgo i sa strane). Više uglova ti daje bolju predstavu o količini i sastavu.

Tvoj krajnji cilj je da TAČNO proceniš nutritivne vrednosti ZA POJEDENU porciju. Ali PRE procene, proveri da li ti fali nešto što bi bitno promenilo rezultat.

Ako je nešto nejasno ili bi značajno uticalo na procenu — postavi KRATKA pitanja (najviše 3), svako sa 2–4 ponuđena kratka odgovora. Tipične nejasnoće: način pripreme (pohovano/grilovano/kuvano), ima li ulja/preliva/sosa, koji su prilozi, i KOLIKO je pojedeno od prikazanog. UVEK pitaj koliko je pojedeno, osim ako se iz slike/opisa jasno vidi.
- Ako više odgovora može da važi istovremeno (npr. koji sve prilozi), stavi "vise_odgovora": true.
- Pitanja i opcije na srpskom (latinica), kratko i konkretno.
- U tom slučaju vrati: "status": "pitanja" i popuni "pitanja".

Ako je sve dovoljno jasno za pouzdanu procenu (retko bez podatka o količini) — preskoči pitanja i vrati: "status": "procena" i popuni polja procene (naziv, sastojci, procenjeni_grami, kcal, protein_g, uh_g, mast_g, sigurnost, napomena), UKUPNO za pojedenu porciju (ne na 100 g).

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const IPEACH_ANALYZE_LABEL_PROMPT = `Dobijaš 1–5 FOTOGRAFIJA nutritivne DEKLARACIJE (tabele) proizvoda, po potrebi i sam proizvod/pakovanje.

Tvoj krajnji cilj je da izračunaš nutritivne vrednosti ZA POJEDENU količinu. Sa deklaracije čitaš vrednosti (na 100 g), ali ti gotovo uvek fali KOLIKO je proizvod ukupno težak i KOLIKO je pojedeno.

Postavi KRATKA pitanja (najviše 3) sa 2–4 ponuđena odgovora da razjasniš: ukupnu masu proizvoda (ako se ne vidi na pakovanju) i pojedenu količinu. UVEK pitaj koliko je pojedeno.
- Pitanja i opcije na srpskom (latinica), kratko.
- Vrati: "status": "pitanja" i popuni "pitanja".

Ako se i ukupna masa i pojedena količina jasno vide/znaju — vrati "status": "procena" sa poljima procene (UKUPNO za pojedenu porciju, skalirano sa vrednosti na 100 g).

Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

// --- FINALIZE prompts (step 2) --------------------------------------------

export const IPEACH_FINALIZE_PROMPT = `Dobijaš FOTOGRAFIJE obroka i korisnikove ODGOVORE na tvoja pitanja (kao tekst i/ili kao glasovni snimak).

Zadatak: na osnovu slika + tih odgovora, proceni nutritivne vrednosti ZA POJEDENU porciju, koristeći OBA izvora zajedno.
- Slike govore ŠTA je na tanjiru i pomažu oko razmere.
- Korisnikovi odgovori nose ključne podatke (način pripreme, prilozi, i posebno KOLIKO je pojedeno) — osloni se na njih.
- Pretvaraj kućne mere u grame realnim balkanskim porcijama (pun tanjir ≈ 250–350 g, velika kašika ≈ 15–20 g, šaka ≈ 30–40 g).

Pravila:
- "naziv": srpski (latinica), kratko i konkretno.
- "sastojci": glavne komponente sa slika/odgovora.
- "procenjeni_grami": ukupna POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju (ne na 100 g).
- "sigurnost": "visoka" kad se slike i odgovori slažu; "srednja"/"niska" kad ima procene.
- "napomena": kratko objasni ključne pretpostavke.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

export const IPEACH_FINALIZE_LABEL_PROMPT = `Dobijaš FOTOGRAFIJE nutritivne deklaracije i korisnikove ODGOVORE (tekst i/ili glasovni snimak) o ukupnoj masi proizvoda i pojedenoj količini.

Zadatak: izračunaj nutritivne vrednosti ZA POJEDENU količinu.
- Sa deklaracije pročitaj vrednosti na 100 g (ako je energija u kJ: kcal = kJ / 4.184).
- Iz odgovora odredi POJEDENU masu u gramima (ukupno × udeo, ili kućna mera → realni grami).
- Pomnoži vrednosti na 100 g sa (pojedeni_grami / 100) za UKUPNO.

Pravila:
- "naziv": naziv proizvoda ako se zna, inače kratko opisno (srpski, latinica).
- "sastojci": [] osim ako se jasno vide.
- "procenjeni_grami": POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju.
- "sigurnost": "visoka" kad su i deklaracija i količina jasni; inače niže.
- "napomena": kratko (npr. "125 g od 250 g paketa").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
