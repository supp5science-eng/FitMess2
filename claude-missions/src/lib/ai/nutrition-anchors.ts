/**
 * Reference numbers every estimating prompt gets, and the hidden-fat rules that
 * are the whole reason this file exists.
 *
 * People underestimate what they eat, and the error is not spread evenly: it
 * concentrates in fat added during cooking. A tablespoon of oil is 126 kcal and
 * visually almost invisible on a plate; breaded-and-fried is +30-40% over the
 * same food grilled. Sweets are barely affected -- a chocolate bar carries a
 * label -- while a home-fried schnitzel has nothing telling anyone that a third
 * of its calories came out of the pan. So the correction belongs exactly there,
 * on the fat, and nowhere else.
 *
 * Until now only Prizma (`prizma.ts`) knew any of this. The fast photo flow, the
 * voice flow and the combined flow -- which is to say the paths most meals
 * actually go through -- had no fat guidance at all, so they under-counted
 * fried food by construction. Extracting the table here lets all of them share
 * one set of numbers instead of drifting apart.
 *
 * What deliberately does NOT get these rules: anything reading a nutrition
 * label (`COMBINED_LABEL_PROMPT`, `label-estimate.ts`). A declared value already
 * contains every gram of fat in the product, so adding oil on top of it would
 * double-count.
 */

/**
 * Hard numbers, not adjectives. "Realne balkanske porcije" tells the model
 * nothing it can compute with; "kašika ulja = 14 g / 126 kcal" does. Fat is
 * listed first because at 9 kcal/g it is where photo-based estimates go wrong:
 * a tablespoon of oil is visually almost invisible and worth more calories
 * than a slice of bread.
 *
 * Moved here verbatim from `prizma.ts` -- the string is unchanged, so Prizma's
 * two prompts are byte-for-byte what they were before the extraction.
 */
export const NUTRITION_ANCHORS = `REFERENTNE VREDNOSTI (koristi ih, ne pogađaj):
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

/**
 * The fat rules for flows whose response schema has a `komponente` breakdown
 * (photo, voice, photo+description). Three things are doing the work here, in
 * order of importance:
 *
 * 1. **Oil gets its own line.** Not because the total would differ -- it
 *    wouldn't -- but because a total the user cannot inspect is a number they
 *    have to take on faith. "ulje od prženja — 20 g, 180 kcal" is visible, and
 *    the confirm screen already lets them strike a line they didn't eat. That
 *    turns a silent correction into a claim the user can refuse, which is the
 *    only version of this feature worth shipping.
 *
 * 2. **Count the fat once.** The anchors above price pomfrit at 310 kcal/100 g,
 *    which is the FRIED value -- the oil is already inside it. Without an
 *    explicit ban, a model told to "always add cooking oil" will happily add a
 *    second helping on top and land 200 kcal high. The rule is therefore
 *    "either in the item or on its own line, never both".
 *
 * 3. **Break ties upward, but only on the fat.** The asymmetry is real and
 *    documented, so resolving an ambiguous fat quantity toward the higher end
 *    is honest. Applying that to the whole meal would not be -- it would just
 *    be a hidden multiplier, and the user would be right not to trust the
 *    number. Scope matters, so the rule names the fat explicitly.
 *
 * The last bullet mirrors `NO_PREP_HINT` in `portion.ts`: a prompt that insists
 * on cooking fat will invent a spoonful of oil under a scoop of ice cream
 * unless it is told where the rule stops.
 */
export const HIDDEN_FAT_RULES = `SKRIVENA MAST — NAJVEĆI IZVOR GREŠKE:
Mast iz pripreme se na slici ne vidi, a nosi 9 kcal po gramu. Procene koje je preskoče ispadnu i 20–40% preniske kod pržene hrane. Zato:
- Mast iz pripreme (ulje, puter, mast) UVEK ide kao ZASEBNA komponenta, npr. "ulje od prženja — 20 g" — nikad utopljena u masu same hrane. Korisnik mora da vidi taj red da bi mogao da ga skine ako je spremao bez masti.
- Koliko dodati, po načinu pripreme:
  - kuvano, na pari, u rerni na papiru, air fryer → 0–2 g
  - sotirano / na malo ulja u tiganju → 8–12 g
  - prženo u dubljoj masti → 15–25 g
  - pohovano (jaje + brašno + prezle) → 20–30 g, ukupno +30–40% kcal u odnosu na nepohovano
- MAST SE BROJI SAMO JEDNOM. Ako si za neku stavku već uzeo vrednost pržene verzije (npr. pomfrit 310 kcal/100 g već sadrži ulje), NE dodaj joj ulje još jednom. Ili je mast u stavci, ili je u zasebnom redu — nikad oba.
- Sos i dresing se takođe ne vide, a nose mnogo: majonez 100 kcal/kašika, pavlaka 30, vinegret ≈ 60, jogurt dresing 15. Ako se na hrani vidi preliv, sjaj ili sos, dodaj ga kao svoju komponentu.
- KAD SE DVOUMIŠ OKO KOLIČINE MASTI, UZMI VEĆU PROCENU i to napiši u "napomena". Kod pržene i masne hrane greška skoro uvek ide naniže. Ovo važi SAMO za mast — ostale komponente procenjuj normalno, bez naduvavanja.
- Ako hrana nije ni pripremana na masti (voće, sirovo povrće, jogurt, sladoled, čokolada, industrijski proizvod), NE dodaj ulje. Mast koja je u samom receptu (npr. u sladoledu ili čokoladi) naravno ostaje u toj stavci.`;

/**
 * The same idea for Gric, compressed.
 *
 * Gric logs snacks as flat items with no `komponente` array, so there is
 * nowhere to put a separate oil line -- the fat has to land inside the item's
 * own kcal. And most of what Gric hears (a cucumber, a handful of seeds, two
 * apricots) has no cooking fat at all, so the long table would be noise on
 * nearly every request. What survives the compression is the part that
 * actually bites: a fried snack from a bakery or a sandwich with mayo.
 *
 * `gric-estimate.ts` was deliberately self-contained when it was written, to
 * avoid depending on another agent's in-flight micronutrient work. That work
 * has since landed, and duplicating these numbers would guarantee the two
 * copies drift, so it imports this one.
 */
export const HIDDEN_FAT_COMPACT = `Skrivena mast: ulje, puter i majonez se ne vide i ne čuju, a nose 9 kcal po gramu — kašika ulja = 126 kcal, kašika majoneza = 100 kcal. Za sitnicu koja je pržena, pohovana ili sa sosom (pomfrit, uštipci, krofna, burek, sendvič sa majonezom) URAČUNAJ tu mast u "kcal" i "mast_g" te stavke. Kad se dvoumiš oko količine masti, uzmi veću procenu. Za voće, povrće, jogurt, čokoladu i proizvode sa deklaracijom NE dodaj ulje — kod njih je mast već u samoj namirnici.`;
