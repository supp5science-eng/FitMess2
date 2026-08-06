// "Najtačniji unos" (M7): the highest-accuracy meal logging path. The user
// gives BOTH a photo of the plate AND a spoken/typed description with a rough
// portion ("pire sa junećim mesom, jedan pun tanjir, pojeo sam skoro sve"). We
// hand Gemini both in a single multimodal request and ask it to fuse them: the
// photo says WHAT is on the plate and helps with scale, the description carries
// the user's own knowledge of HOW MUCH they ate -- which a photo alone can't
// judge. That fusion is the whole accuracy win. The response shape + defensive
// Zod parse are the same ones the meal-photo flow already uses, so the
// confirm/edit screen and the `logs` write stay shared, not duplicated.

import { MICRO_PROMPT_RULES } from "@/lib/ai/meal-estimate";
import {
  HIDDEN_FAT_RULES,
  NUTRITION_ANCHORS,
} from "@/lib/ai/nutrition-anchors";

export {
  mealEstimateSchema as combinedMealSchema,
  MEAL_RESPONSE_SCHEMA as COMBINED_RESPONSE_SCHEMA,
  type MealEstimate as CombinedMealEstimate,
} from "@/lib/ai/meal-estimate";

export const COMBINED_PROMPT = `Dobijaš FOTOGRAFIJU obroka i korisnikov OPIS (govorni snimak i/ili tekst) u kome kaže šta je jeo i grubu procenu količine (npr. "pire sa junećim mesom, jedan pun tanjir, pojeo sam skoro sve").

Zadatak: proceni nutritivne vrednosti ZA KOLIČINU KOJU JE KORISNIK POJEO, koristeći OBA izvora ZAJEDNO.

Kako da kombinuješ:
- Slika ti govori ŠTA je na tanjiru i pomaže oko razmere i izgleda porcije.
- Korisnikov opis nosi NAJPOUZDANIJU informaciju o količini — on zna koliko je pojeo. Kad korisnik navede količinu ("jedan tanjir", "pola", "dve velike kašike", "200 g"), osloni se na to, a sliku koristi da proveriš i dopuniš (npr. ulje, prilozi, dodaci koje nije spomenuo).
- Ako se slika i opis razlikuju, veruj korisnikovoj količini, ali to kratko spomeni u "napomena".
- Ako korisnik sam kaže KAKO je spremljeno ("pekla sam u rerni bez ulja", "prženo na puno ulja", "bez dresinga"), njegova reč je jača od tvoje procene masti — primeni je i preskoči pravilo o dvoumljenju ispod.
- Pretvaraj kućne mere u grame realnim balkanskim porcijama (npr. pun tanjir pirea ≈ 250–350 g, velika kašika ≈ 15–20 g, šaka ≈ 30–40 g).

Pravila:
- "naziv": na srpskom (latinica), kratko i konkretno.
- "sastojci": glavne komponente koje prepoznaješ sa slike ili iz opisa.
- "procenjeni_grami": ukupna POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju (ne na 100 g).
${MICRO_PROMPT_RULES}
- "sigurnost": "visoka" kad se slika i jasan opis slažu; "srednja"/"niska" kad je nešto nejasno ili se izvori kose.
- "napomena": kratko objasni ključne pretpostavke ili neslaganje slike i opisa.

${HIDDEN_FAT_RULES}

${NUTRITION_ANCHORS}

- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

// V2 variant: the photo is a NUTRITION LABEL (deklaracija), and the user says
// how much the product weighs in total AND how much they ate ("ceo paket 250 g,
// pojeo sam pola" / "dve velike kašike"). We read per-100g off the label and
// scale it to the consumed mass the user describes. Same response schema.
export const COMBINED_LABEL_PROMPT = `Dobijaš FOTOGRAFIJU nutritivne deklaracije (tabele) proizvoda i korisnikov OPIS (glas i/ili tekst) u kome kaže KOLIKO UKUPNO ima proizvod i KOLIKO je pojeo (npr. "ceo paket je 250 grama, pojeo sam pola" ili "uzeo sam dve velike kašike").

Zadatak: izračunaj nutritivne vrednosti ZA KOLIČINU KOJU JE KORISNIK POJEO.

Kako:
- Sa deklaracije pročitaj vrednosti NA 100 g (kcal, proteini, ugljeni hidrati, masti). Ako su date po porciji, preračunaj na 100 g. Ako je energija u kJ, pretvori u kcal (kcal = kJ / 4.184).
- Iz opisa odredi POJEDENU masu u gramima:
  - ukupna masa + udeo ("250 g, pojeo pola") → pojedeno = 250 × 0,5 = 125 g;
  - kućna mera ("dve velike kašike") → proceni realno (velika kašika ≈ 15–20 g, šolja ≈ 240 g);
  - direktno grami → koristi tačno tu vrednost.
- Pomnoži vrednosti na 100 g sa (pojedeni_grami / 100) da dobiješ UKUPNO za pojedenu porciju.

Pravila:
- "naziv": naziv proizvoda ako se vidi/čuje, inače kratko opisno (srpski, latinica).
- "sastojci": prazan niz [] osim ako se jasno vide.
- "procenjeni_grami": POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju (skalirano sa 100 g).
${MICRO_PROMPT_RULES}
- Ako deklaracija navodi vlakna, šećere, so/natrijum ili zasićene masti, pročitaj ih sa tabele i skaliraj isto kao makroe; ako ih nema na tabeli, proceni po vrsti proizvoda. Za so na deklaraciji ("so 1,2 g"): natrijum_mg = 1,2 × 400 = 480.
- "sigurnost": "visoka" kad su i deklaracija i količina jasni; "srednja"/"niska" kad procenjuješ.
- "napomena": kratko (npr. "125 g od 250 g paketa").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
