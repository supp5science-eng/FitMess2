import type { LogComponentSnapshot } from "@/lib/types/db";

// Turning spoken items into `logs` rows (2026-08-02).
//
// ## Why this file exists
//
// Gric used to write ONE ROW PER ITEM. Say "jaja, slaninu i hleb" and the day
// showed three entries — which is wrong twice over: it wasn't three things you
// ate, it was one plate, and "Obroci danas" turned into a receipt instead of a
// list of meals.
//
// So items now arrive tagged with the occasion they belong to (`group`, decided
// by the model — see `GRIC_PROMPT`), and everything eaten together collapses
// into a single row whose parts survive in `logs.components` (0019). That last
// part matters: the row is one meal for the day's total and for the card, but
// "Dodaj još" can still offer "+1 jaje" inside it, exactly as it does for a
// photographed plate.
//
// Everything here is pure and lives outside the server action so the review
// screen can show the user precisely the rows that will be written.

/** One spoken item, ready to be grouped. */
export interface GricRowItem {
  name: string;
  /** Spoken amount ("2 komada", "šaka") — the only clue to the natural unit. */
  amount?: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Opaque occasion id; items sharing one were eaten together. Missing = the
   * item stands alone, which is what the "Opet isto" shortcut sends. */
  group?: number;
}

/** One `logs` row: a whole eating occasion. */
export interface GricRow {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** The parts, when there was more than one. `null` for a single item — a
   * breakdown of one line says nothing the row doesn't already say. */
  components: LogComponentSnapshot[] | null;
}

/** Past this, a joined name stops being readable on a meal card. */
const MAX_NAME_CHARS = 60;
/** Past this many parts, list the first few and count the rest. */
const MAX_NAMED_PARTS = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;
const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Groups items by occasion, preserving the order they were spoken in.
 *
 * Items without a group each get their own occasion, so a caller that knows
 * nothing about grouping (the one-tap "Opet isto" chips) keeps the old
 * one-row-per-item behaviour for free.
 */
export function groupByOccasion<T extends { group?: number }>(
  items: readonly T[]
): T[][] {
  const groups: T[][] = [];
  const byId = new Map<number, T[]>();

  items.forEach((item, index) => {
    // A missing group must never collide with a real one, hence the negative
    // synthetic ids.
    const id = typeof item.group === "number" ? item.group : -(index + 1);
    const existing = byId.get(id);
    if (existing) {
      existing.push(item);
      return;
    }
    const fresh = [item];
    byId.set(id, fresh);
    groups.push(fresh);
  });

  return groups;
}

/** Lowercases the leading letter — "Slanina" reads as a list item, not as the
 * start of a new sentence, once it sits after a comma. */
const asListItem = (name: string): string =>
  name.length > 0 ? name[0].toLocaleLowerCase("sr-Latn") + name.slice(1) : name;

/**
 * The name a joined occasion gets: "Jaja, slanina i hleb".
 *
 * Built here rather than asked of the model on purpose — a generated name would
 * drift towards labels like "Doručak", and what the user needs to recognise on
 * the card six hours later is WHAT they ate, not which slot it fell into.
 */
export function occasionName(names: readonly string[]): string {
  const parts = names.map((name) => name.trim()).filter(Boolean);
  if (parts.length === 0) return "Obrok";
  if (parts.length === 1) return parts[0];

  const join = (list: string[]): string => {
    const [first, ...rest] = list;
    const tail = rest.map(asListItem);
    if (tail.length === 1) return `${first} i ${tail[0]}`;
    return `${first}, ${tail.slice(0, -1).join(", ")} i ${tail[tail.length - 1]}`;
  };

  const full = join(parts);
  if (parts.length <= MAX_NAMED_PARTS && full.length <= MAX_NAME_CHARS) {
    return full;
  }

  // Too long or too many: name what fits and count the rest, so the card stays
  // one line instead of wrapping into a paragraph.
  const shown = parts.slice(0, 2);
  const restCount = parts.length - shown.length;
  const head = `${shown[0]}, ${asListItem(shown[1])}`;
  const withCount = `${head} i još ${restCount}`;
  return withCount.length <= MAX_NAME_CHARS
    ? withCount
    : `${shown[0]} i još ${parts.length - 1}`;
}

/** Serbian measure words we can recognise, mapped to the singular form a
 * stepper can print ("1 kriška · 35 g"). */
const UNIT_WORDS: Record<string, string> = {
  komad: "komad",
  komada: "komad",
  komadi: "komad",
  kasika: "kašika",
  kasike: "kašika",
  kasiku: "kašika",
  kasicica: "kašičica",
  kasicice: "kašičica",
  kriska: "kriška",
  kriske: "kriška",
  krisku: "kriška",
  parce: "parče",
  parceta: "parče",
  parcad: "parče",
  saka: "šaka",
  sake: "šaka",
  saku: "šaka",
  casa: "čaša",
  case: "čaša",
  casu: "čaša",
  solja: "šolja",
  solje: "šolja",
  solju: "šolja",
  red: "red",
  reda: "red",
  redovi: "red",
  kocka: "kocka",
  kocke: "kocka",
  kocku: "kocka",
  prstohvat: "prstohvat",
  kugla: "kugla",
  kugle: "kugla",
  kuglu: "kugla",
  supljakasika: "kašika",
};

/** Spelled-out counts that actually appear in speech. Deliberately excludes
 * vague ones ("nekoliko", "malo") — guessing a count there would invent a unit
 * mass out of nothing. */
const WORD_NUMBERS: Record<string, number> = {
  jedan: 1,
  jedna: 1,
  jedno: 1,
  dva: 2,
  dve: 2,
  par: 2,
  tri: 3,
  cetiri: 4,
  pet: 5,
  sest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
  deset: 10,
};

/** Accent-folded, punctuation-free lowercase word, so "Kašike," matches. */
const fold = (word: string): string =>
  word
    .toLocaleLowerCase("sr-Latn")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Reads the natural unit out of a spoken amount: "2 komada" of 100 g becomes
 * one 50 g "komad".
 *
 * This is what makes a Gric occasion steppable the same way a photographed meal
 * is — without asking the model for two more fields per item, on the one flow
 * where latency IS the feature. When nothing is recognisable it returns no unit
 * at all, and "Dodaj još" falls back to repeating the whole line, which is the
 * behaviour those entries had before.
 */
export function naturalUnit(
  amount: string | undefined,
  grams: number
): { kom_naziv: string; kom_grami: number } {
  const none = { kom_naziv: "", kom_grami: 0 };
  const total = nonNegative(grams);
  if (!amount || total <= 0) return none;

  const words = amount.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return none;

  let count: number | null = null;
  let unit: string | null = null;

  for (const word of words) {
    const digits = word.match(/^(\d+(?:[.,]\d+)?)/);
    if (digits && count === null) {
      count = Number(digits[1].replace(",", "."));
      // "2kom" — the unit can be glued to the number.
      const rest = fold(word.slice(digits[1].length));
      if (rest && UNIT_WORDS[rest] && unit === null) unit = UNIT_WORDS[rest];
      continue;
    }
    const folded = fold(word);
    if (!folded) continue;
    if (unit === null && UNIT_WORDS[folded]) {
      unit = UNIT_WORDS[folded];
      continue;
    }
    if (count === null && WORD_NUMBERS[folded] !== undefined) {
      count = WORD_NUMBERS[folded];
    }
  }

  // A bare count with no measure word ("2 kajsije") is still countable — the
  // piece just has no better name than "komad".
  if (count !== null && count >= 1 && unit === null) unit = "komad";
  if (unit === null) return none;
  if (count === null || count < 1) count = 1;

  const unitGrams = round1(total / count);
  // A unit that is heavier than the whole item is a misread, not a unit.
  if (unitGrams <= 0 || unitGrams > total) return none;
  return { kom_naziv: unit, kom_grami: unitGrams };
}

/** One item as a breakdown line of the occasion it belongs to. */
export function gricComponent(item: GricRowItem): LogComponentSnapshot {
  const grams = round1(nonNegative(item.grams));
  const { kom_naziv, kom_grami } = naturalUnit(item.amount, grams);
  return {
    naziv: item.name.trim() || "Sitnica",
    grami: grams,
    kcal: Math.round(nonNegative(item.kcal)),
    protein_g: round1(nonNegative(item.protein)),
    uh_g: round1(nonNegative(item.carbs)),
    mast_g: round1(nonNegative(item.fat)),
    kom_naziv,
    kom_grami,
  };
}

/**
 * The rows a Gric save writes: one per eating occasion.
 *
 * The occasion's totals are the SUM OF ITS PARTS rather than anything sent
 * alongside them, so the row and its breakdown can never disagree — which is
 * the invariant "Dodaj još" and "Nisam sve pojeo" both rescale against.
 */
export function buildGricRows(items: readonly GricRowItem[]): GricRow[] {
  return groupByOccasion(items).map((group) => {
    const parts = group.map(gricComponent);
    const sum = (pick: (part: LogComponentSnapshot) => number) =>
      parts.reduce((total, part) => total + pick(part), 0);

    return {
      name: occasionName(parts.map((part) => part.naziv)),
      grams: round1(sum((part) => part.grami)),
      kcal: Math.round(sum((part) => part.kcal)),
      protein: round1(sum((part) => part.protein_g)),
      carbs: round1(sum((part) => part.uh_g)),
      fat: round1(sum((part) => part.mast_g)),
      components: parts.length > 1 ? parts : null,
    };
  });
}
