import { foldSerbian } from "@/lib/food/emoji";

/**
 * Serbian noun forms for the portion units "Dodaj još" shows ("6 jaja", "2
 * jajeta", "3 kašike").
 *
 * Why bother: the sheet's whole job is to feel like it was written by someone
 * who eats. "2 jaje" and "5 kašika" written as "5 kašika" vs "5 kašike" is the
 * difference between an app that speaks Serbian and one that concatenates
 * strings -- and this text sits directly under the user's thumb, read once per
 * snack. The `×` escape hatch ("6 × šnita") is always available for a unit we
 * don't know, so an unknown word degrades to something correct rather than
 * something wrong.
 *
 * Serbian numeral agreement (the rule this encodes):
 *   * ends in 1, but not 11              -> singular      ("1 jaje", "21 jaje")
 *   * ends in 2/3/4, but not 12/13/14    -> paucal         ("2 jajeta")
 *   * everything else                    -> genitive plural ("5 jaja")
 */

interface UnitForms {
  /** 1, 21, 31... */
  one: string;
  /** 2-4, 22-24... */
  few: string;
  /** 0, 5-20, 25-30... */
  many: string;
}

/**
 * The units the meal-splitting prompt actually asks for (`kom_naziv` in
 * `src/lib/ai/split-meal.ts`), keyed by their accent-folded singular. Kept
 * deliberately small: these are portion words, not a Serbian dictionary, and an
 * unlisted one falls back to the `×` form instead of being guessed at.
 */
const UNIT_FORMS: Record<string, UnitForms> = {
  jaje: { one: "jaje", few: "jajeta", many: "jaja" },
  kasika: { one: "kašika", few: "kašike", many: "kašika" },
  kasicica: { one: "kašičica", few: "kašičice", many: "kašičica" },
  kriska: { one: "kriška", few: "kriške", many: "kriški" },
  komad: { one: "komad", few: "komada", many: "komada" },
  parce: { one: "parče", few: "parčeta", many: "parčeta" },
  solja: { one: "šolja", few: "šolje", many: "šolja" },
  casa: { one: "čaša", few: "čaše", many: "čaša" },
  saka: { one: "šaka", few: "šake", many: "šaka" },
  konzerva: { one: "konzerva", few: "konzerve", many: "konzervi" },
  kesica: { one: "kesica", few: "kesice", many: "kesica" },
  kocka: { one: "kocka", few: "kocke", many: "kocki" },
  kugla: { one: "kugla", few: "kugle", many: "kugli" },
  porcija: { one: "porcija", few: "porcije", many: "porcija" },
  list: { one: "list", few: "lista", many: "listova" },
  zrno: { one: "zrno", few: "zrna", many: "zrna" },
  ploska: { one: "ploška", few: "ploške", many: "ploški" },
  supljina: { one: "šolja", few: "šolje", many: "šolja" },
};

/** Picks the form Serbian numeral agreement calls for. */
export function serbianNumberForm(count: number): keyof UnitForms {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "many";
  if (last === 1) return "one";
  if (last >= 2 && last <= 4) return "few";
  return "many";
}

/**
 * "6 jaja", "2 kašike", "3 × šnita" -- a count with its unit in the right form,
 * falling back to the unambiguous `×` notation for a unit we don't have forms
 * for (and to a bare number when there is no unit at all).
 */
export function formatUnitCount(count: number, unit: string | undefined): string {
  const n = Math.max(Math.trunc(count), 0);
  const trimmed = (unit ?? "").trim();
  if (!trimmed) return String(n);

  const forms = UNIT_FORMS[foldSerbian(trimmed)];
  if (!forms) return `${n} × ${trimmed}`;

  return `${n} ${forms[serbianNumberForm(n)]}`;
}
