// "Najtačniji unos" (M7): the highest-accuracy meal logging path. The user
// gives BOTH a photo of the plate AND a spoken/typed description with a rough
// portion ("pire sa junećim mesom, jedan pun tanjir, pojeo sam skoro sve"). We
// hand Gemini both in a single multimodal request and ask it to fuse them: the
// photo says WHAT is on the plate and helps with scale, the description carries
// the user's own knowledge of HOW MUCH they ate -- which a photo alone can't
// judge. That fusion is the whole accuracy win. The response shape + defensive
// Zod parse are the same ones the meal-photo flow already uses, so the
// confirm/edit screen and the `logs` write stay shared, not duplicated.

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
- Pretvaraj kućne mere u grame realnim balkanskim porcijama (npr. pun tanjir pirea ≈ 250–350 g, velika kašika ≈ 15–20 g, šaka ≈ 30–40 g).

Pravila:
- "naziv": na srpskom (latinica), kratko i konkretno.
- "sastojci": glavne komponente koje prepoznaješ sa slike ili iz opisa.
- "procenjeni_grami": ukupna POJEDENA masa u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za pojedenu porciju (ne na 100 g).
- "sigurnost": "visoka" kad se slika i jasan opis slažu; "srednja"/"niska" kad je nešto nejasno ili se izvori kose.
- "napomena": kratko objasni ključne pretpostavke ili neslaganje slike i opisa.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
