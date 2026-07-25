// Voice meal logging (M7 / "Reci obrok"). The user speaks -- in Serbian --
// about something they ate or drank, either DICTATING the nutrition values
// straight off a label ("proteinski puding, 210 kalorija, 20 grama proteina")
// or just DESCRIBING it ("popio sam proteinski puding"). We hand Gemini the
// audio and ask for the same strict JSON shape the meal-photo flow already
// uses, so the confirm/edit screen and the `logs` write are shared, not
// duplicated. This file only owns the spoken-input prompt; the response schema
// and the defensive Zod parse are re-exported from the meal-photo module.

import { MICRO_PROMPT_RULES } from "@/lib/ai/meal-estimate";

export {
  mealEstimateSchema as voiceMealSchema,
  MEAL_RESPONSE_SCHEMA as VOICE_RESPONSE_SCHEMA,
  type MealEstimate as VoiceMealEstimate,
} from "@/lib/ai/meal-estimate";

export const VOICE_PROMPT = `U audio snimku korisnik na srpskom govori o hrani ili piću koje je pojeo ili popio.
Izvuci nutritivne vrednosti ZA KOLIČINU KOJU JE KORISNIK KONZUMIRAO (ne na 100 g).

Dva slučaja:
1) Korisnik NAVODI vrednosti (npr. "proteinski puding, dvesta deset kalorija, dvadeset grama proteina, osam ugljenih hidrata, pet masti") — koristi TAČNO te izgovorene brojeve.
2) Korisnik samo OPISUJE šta je jeo/pio bez brojeva (npr. "popio sam proteinski puding") — proceni realne vrednosti za tipičnu porciju.

Pravila:
- "naziv": na srpskom (latinica), kratko i konkretno (npr. "Proteinski puding").
- "sastojci": prazan niz [] osim ako korisnik izričito nabraja komponente.
- "procenjeni_grami": masa/zapremina konzumirane porcije u gramima (za tečnost 1 ml ≈ 1 g). Ako je korisnik naveo gramažu/zapreminu, koristi to; inače proceni tipičnu porciju.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za konzumiranu porciju.
${MICRO_PROMPT_RULES}
- "sigurnost": "visoka" ako je korisnik jasno izgovorio brojeve; "srednja" ili "niska" kada procenjuješ.
- "napomena": kratko (npr. "vrednosti izgovorene" ili "procenjena tipična porcija od 150 g").
- Ako u snimku NEMA hrane/pića ili je nerazumljivo, vrati "naziv": "Nejasan unos", sve brojeve 0, "sigurnost": "niska".
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
