// F023: pure, DB-free Serbian Cyrillic -> Latin transliteration.
//
// Covers AS-037 (searching with Cyrillic input returns foods stored with
// Latin names): every food in `public.foods` is stored as sr-Latn
// (name_sr, brand -- see supabase/seed/foods.json and 0004_foods_logs.sql),
// so a user typing the query in Cyrillic needs it converted to Latin BEFORE
// it reaches the search RPC. `cyrillicToLatin` is the pure conversion step;
// `src/lib/food/search.ts` wires it into the actual search call.
//
// Serbian Cyrillic is a one-to-one alphabet with Serbian Latin: every
// Cyrillic letter -- including the three "digraph" letters љ/њ/џ, each a
// SINGLE Unicode code point -- maps onto exactly one Latin
// letter-or-digraph (lj/nj/dž). Because the digraph letters are single
// Cyrillic code points, this is a simple character-by-character lookup: no
// multi-character Cyrillic sequence detection is ever needed on the input
// side. Characters not in the table (Latin letters already, digits,
// punctuation, whitespace) pass through unchanged, which is what makes it
// safe to call unconditionally on every search query regardless of script
// (AS-036's Latin-script queries are simply a no-op pass-through here).

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ђ: "đ",
  е: "e",
  ж: "ž",
  з: "z",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ћ: "ć",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "č",
  џ: "dž",
  ш: "š",
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Ђ: "Đ",
  Е: "E",
  Ж: "Ž",
  З: "Z",
  И: "I",
  Ј: "J",
  К: "K",
  Л: "L",
  Љ: "Lj",
  М: "M",
  Н: "N",
  Њ: "Nj",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  Ћ: "Ć",
  У: "U",
  Ф: "F",
  Х: "H",
  Ц: "C",
  Ч: "Č",
  Џ: "Dž",
  Ш: "Š",
};

/** True if `input` contains at least one Serbian Cyrillic letter (Unicode
 * Cyrillic block, U+0400-U+04FF). Exported for callers/tests that want to
 * short-circuit or log without re-running the full transliteration. */
export function hasCyrillic(input: string): boolean {
  return /[Ѐ-ӿ]/.test(input);
}

/**
 * Converts every Serbian Cyrillic character in `input` to its Latin
 * equivalent (including the lj/nj/dž digraphs for љ/њ/џ), leaving every
 * other character (already-Latin letters, digits, punctuation, whitespace)
 * untouched. Safe to call on ANY input, Cyrillic or not -- Latin-script
 * input round-trips unchanged (AS-036), Cyrillic input becomes the Latin
 * spelling the `foods` catalog actually stores (AS-037).
 */
export function cyrillicToLatin(input: string): string {
  let out = "";
  for (const ch of input) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out;
}
