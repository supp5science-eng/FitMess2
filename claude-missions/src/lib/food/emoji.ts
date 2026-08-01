/**
 * Maps a Serbian food name to a representative emoji, used by the meal-history
 * list (`/analitika`) in place of a photo -- logged meals rarely carry an
 * image, so a food-type emoji ("piletina" -> 🍗) gives each row a friendly,
 * instantly-scannable icon without any upload.
 *
 * Deliberately a small, ordered keyword table rather than an exhaustive food
 * database: match the FIRST rule whose keyword appears in the (accent-folded,
 * lowercased) name. Order matters -- more specific keywords come before
 * generic ones (e.g. "ćevap" before a bare "meso"), and anything unmatched
 * falls back to a neutral plate 🍽️. Pure and deterministic; easy to extend.
 */

/** Fold Serbian-Latin diacritics so "ćevap"/"cevap", "šunka"/"sunka" match
 * the same ASCII keyword. Lowercased for case-insensitive matching. */
export function foldSerbian(input: string): string {
  return input
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj");
}

// [emoji, keywords...] -- first matching keyword (substring) wins, top to
// bottom. Keywords are already accent-folded/lowercased.
const EMOJI_RULES: readonly (readonly [string, ...string[]])[] = [
  ["🍗", "piletin", "pilec", "pile ", "curetin", "curet", "batak", "krilc"],
  ["🐟", "riba", "ribl", "losos", "tuna", "oslic", "pastrmk", "brancin", "sardin", "skus", "orada"],
  ["🦐", "skamp", "kozic", "plod mora", "lignj", "dagnj"],
  ["🥩", "junet", "govedin", "teletin", "svinjsk", "biftek", "odrezak", "snicl", "cevap", "pljeskavic", "rostilj", "rebarc", "meso", "slanin", "sunk", "pecenic", "vesalic", "kotlet"],
  ["🌭", "hot dog", "hotdog", "virsl", "kobasic", "hrenovk"],
  ["🍔", "burger", "hamburger", "pljeskavica u lepin", "sendvic", "sendvi"],
  ["🍕", "pica", "pizza"],
  ["🌯", "tortilj", "burito", "rol", "wrap", "durum"],
  ["🥚", "jaje", "jaja", "kajgan", "omlet", "belanc", "zumanc"],
  ["🥐", "burek", "pita sa", "gibanic", "krofn", "kroasan", "pecivo", "kifl", "zemick", "perec"],
  ["🥞", "palacink", "vafl", "wafl", "pancake"],
  ["🍞", "hleb", "tost", "dvopek", "prepecen"],
  ["🍚", "pirinac", "riza", "rizot", "rizot", "palent", "kus kus", "kuskus", "bulgur"],
  ["🍝", "testenin", "pasta", "spaget", "makaron", "njok", "lazanj", "rezanc"],
  ["🍟", "pomfrit", "pommes", "przen krompir", "cips", "cips"],
  ["🥔", "krompir", "pire"],
  ["🍲", "pasulj", "grah", "supa", "corb", "corba", "varivo", "gulas", "sarm", "punjen", "paprikas", "boranij", "sac"],
  ["🥗", "salat", "zelen", "kupus", "blitv", "spanac", "rukol"],
  ["🍅", "paradajz", "paradaj"],
  ["🥒", "krastavac", "kiseli krast"],
  ["🥕", "sargarep", "mrkv"],
  ["🌽", "kukuruz"],
  ["🥦", "brokol", "karfiol", "prokelj"],
  ["🍄", "pecurk", "gljiv", "sampinjon", "vrganj"],
  ["🧅", "crni luk", "praziluk", "crveni luk"],
  ["🧄", "beli luk"],
  ["🥑", "avokado"],
  ["🍎", "jabuk"],
  ["🍌", "banan"],
  ["🍊", "pomorandz", "narandz", "mandarin", "klementin"],
  ["🍋", "limun", "limet"],
  ["🍓", "jagod"],
  ["🫐", "borovnic", "kupin", "malin"],
  ["🍇", "grozdj", "grozd"],
  ["🍉", "lubenic"],
  ["🍈", "dinj"],
  ["🍑", "breskv", "nektarin", "kajsij"],
  ["🍐", "krusk"],
  ["🍍", "ananas"],
  ["🥝", "kivi"],
  ["🍒", "tresnj", "visnj"],
  ["🥜", "orah", "orasi", "badem", "lesnik", "kikiriki", "indijsk", "puter od kik", "kesten"],
  ["🧀", "sir", "kajmak", "feta", "mocarel", "gaud", "parmez"],
  ["🥛", "mleko", "mlek", "jogurt", "kiselo mlek", "kefir", "surutk"],
  ["🧈", "puter", "maslac", "margarin"],
  ["🍫", "cokolad", "nutel", "kakao", "eurokrem"],
  ["🍰", "kolac", "torta", "biskvit", "krem", "baklav", "cheesecake", "cizkejk", "sladoled od torte"],
  ["🍪", "keks", "biskvi", "cipsic", "napolitank", "plazm"],
  ["🍦", "sladoled", "sorbe"],
  ["🍮", "puding", "krema", "flan"],
  ["🍯", "med"],
  ["🥣", "musli", "granol", "ovsen", "zoben", "kasic", "kasa", "corn flakes", "pahuljic"],
  ["🥤", "protein", "sejk", "sejik", "whey", "vej ", "gejner", "smuti", "smoothie"],
  ["☕", "kafa", "espreso", "kapucin", "makijat", "latte", "late", "nescaf"],
  ["🍵", "caj", "matcha", "maca"],
  ["🧃", "sok", "cedjen", "ceden", "negazir", "gazir", "nektar"],
  ["🥃", "rakij", "viski", "vinjak"],
  ["🍺", "pivo", "toceno"],
  ["🍷", "vino", "vinj"],
  ["💧", "voda", "mineraln"],
  // Condiments and added fats, last on purpose: these words also appear inside
  // dish names ("kupus salata sa uljem"), and there the DISH is what the row is
  // about. Only a food that matched nothing above is really the condiment
  // itself -- which is exactly what "Dodaj još" adds as a standalone line.
  ["🍅", "kecap"],
  ["🌶️", "ajvar"],
  ["🥄", "majonez", "senf", "tartar", "dresing", "sos"],
  // Sour cream lives in a tub with a spoon in it, not in a milk glass.
  ["🥣", "pavlak"],
  ["🫒", "ulje", "maslin"],
  ["🍬", "secer"],
];

/** Returns the emoji for a food/meal name; falls back to 🍽️ if nothing
 * matches. */
export function foodEmoji(name: string): string {
  const folded = foldSerbian(name);
  for (const [emoji, ...keywords] of EMOJI_RULES) {
    for (const keyword of keywords) {
      if (folded.includes(keyword)) return emoji;
    }
  }
  return "🍽️";
}
