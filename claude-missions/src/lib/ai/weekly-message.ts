import type { WeeklyTrendResult } from "@/lib/weight/weekly-trend";

/**
 * Nedeljno merenje: the Gemini layer, which is allowed to WRITE and forbidden
 * to DECIDE.
 *
 * Everything numeric on the weekly card -- the trend, the measured TDEE, the
 * new daily target -- is produced by `weekly-trend.ts`, deterministically, from
 * the user's own weigh-ins and food log. This module's only job is to turn
 * those settled numbers into two or three sentences of Serbian that sound like
 * a person rather than a spreadsheet. The app's "money-math rule" applies with
 * full force: the model never computes, never rounds a target, never decides
 * whether a plan should change.
 *
 * That rule is not left to the prompt to enforce. `numbersAreFaithful` below
 * re-reads the model's own output and rejects it if a calorie-scale number
 * appears that we did not hand it -- a hallucinated "predlažem 2.200 kcal"
 * cannot reach the screen even if the instruction is ignored. A rejected reply
 * simply loses to the template the card already rendered, which is why there is
 * no user-visible failure mode here at all.
 */

export interface WeeklyMessageFacts {
  status: WeeklyTrendResult["status"];
  goal: string | null;
  currentWeightKg: number | null;
  trendKgPerWeek: number | null;
  expectedMinKgPerWeek: number | null;
  expectedMaxKgPerWeek: number | null;
  measuredTdeeKcal: number | null;
  plannedTdeeKcal: number | null;
  avgDailyKcal: number | null;
  measuredDays: number;
  weighInCount: number;
  currentDailyKcal: number;
  suggestedDailyKcal: number | null;
  suggestionDirection: "cut" | "add" | null;
  extraSteps: number | null;
  capped: boolean;
}

/** Builds the facts payload the model is allowed to speak about. */
export function weeklyMessageFacts(
  trend: WeeklyTrendResult,
  currentDailyKcal: number,
  goal: string | null
): WeeklyMessageFacts {
  return {
    status: trend.status,
    goal,
    currentWeightKg: trend.currentWeightKg,
    trendKgPerWeek: trend.trendKgPerWeek,
    expectedMinKgPerWeek: trend.expected?.minKgPerWeek ?? null,
    expectedMaxKgPerWeek: trend.expected?.maxKgPerWeek ?? null,
    measuredTdeeKcal: trend.measuredTdeeKcal,
    plannedTdeeKcal: trend.plannedTdeeKcal,
    avgDailyKcal: trend.avgDailyKcal,
    measuredDays: trend.measuredDays,
    weighInCount: trend.weighInCount,
    currentDailyKcal,
    suggestedDailyKcal: trend.suggestion?.newDailyKcal ?? null,
    suggestionDirection: trend.suggestion?.direction ?? null,
    extraSteps: trend.suggestion?.extraSteps ?? null,
    capped: trend.suggestion?.capped ?? false,
  };
}

export const WEEKLY_MESSAGE_PROMPT = `Ti si trener u srpskoj aplikaciji za ishranu FitMess. Dobijaš GOTOVE brojeve o nedeljnom merenju jednog korisnika i tvoj JEDINI zadatak je da ih prepričaš na srpskom, ljudski.

APSOLUTNA ZABRANA:
- Ne računaj ništa. Ne sabiraj, ne oduzimaj, ne procenjuj, ne zaokružuj u novi cilj.
- Ne pominji nijedan broj koji ti nije dat. Ako broja nema u podacima, nema ga ni u poruci.
- Ne predlaži svoj plan, svoj deficit, svoj broj kalorija ni bilo kakvu dijetu.
- Ne daj medicinski savet i ne pominji bolesti, lekove ni poremećaje ishrane.

KAKO PIŠEŠ:
- Srpski, latinica, obraćanje na "ti".
- Najviše 3 rečenice, ukupno do 45 reči.
- Bez emodžija, bez uzvičnika, bez fraza tipa "svaka čast" i "samo napred".
- Bez krivice: ako se plan nije poklopio sa vagom, pogrešila je PROCENA POTROŠNJE, ne korisnik. To je i istina — potrošnja se do sada računala iz formule.
- Ako je status STALLED ili TOO_SLOW, objasni da izmerena potrošnja ispada niža od one koju je plan pretpostavljao, pa zato predlažemo novi broj.
- Ako je status TOO_FAST, objasni da je tempo brži nego što je zdravo i da zato predlažemo VIŠE hrane, ne manje.
- Ako je status ON_TRACK, kratko potvrdi da se ništa ne menja.
- Nikad ne piši da je plan već promenjen. Korisnik tek treba da odluči.

Vrati SAMO tekst poruke, bez navodnika i bez naslova.`;

/**
 * Every number the model is allowed to say. Anything calorie-scale outside this
 * set means it invented something.
 */
export function allowedNumbers(facts: WeeklyMessageFacts): number[] {
  const values = [
    facts.currentWeightKg,
    facts.measuredTdeeKcal,
    facts.plannedTdeeKcal,
    facts.avgDailyKcal,
    facts.currentDailyKcal,
    facts.suggestedDailyKcal,
    facts.extraSteps,
    facts.measuredDays,
    facts.weighInCount,
  ];

  const out: number[] = [];
  for (const value of values) {
    if (value != null && Number.isFinite(value)) out.push(Math.abs(value));
  }
  // The DIFFERENCE between the old and new target is a number a human would
  // naturally reach for ("250 kcal manje"), and it is derived, not invented.
  if (facts.suggestedDailyKcal != null) {
    out.push(Math.abs(facts.suggestedDailyKcal - facts.currentDailyKcal));
  }
  return out;
}

/** Calorie-scale numbers appearing in a Serbian text, thousand separators
 * (`2.600`, `2 600`) collapsed first so they read as one number, not two. */
export function extractLargeNumbers(text: string): number[] {
  // Separators written as escapes on purpose: a literal non-breaking space
  // inside a character class is invisible to the next reader of this file.
  const normalized = text.replace(
    /(\d)[.\u00A0\u202F\u0020](\d{3})(?!\d)/g,
    "$1$2"
  );
  const matches = normalized.match(/\d+/g) ?? [];
  return matches.map(Number).filter((value) => value >= 100);
}

/**
 * True when every calorie-scale number in the reply is one we supplied.
 *
 * A tolerance of 50 kcal (or 2%, whichever is larger) is allowed, because
 * "oko 2.600" for 2.643 is how a person speaks and is not a different claim.
 * Anything further out is a number the model made up, and the reply is dropped.
 */
export function numbersAreFaithful(
  text: string,
  facts: WeeklyMessageFacts
): boolean {
  const allowed = allowedNumbers(facts);
  if (allowed.length === 0) return extractLargeNumbers(text).length === 0;

  return extractLargeNumbers(text).every((value) =>
    allowed.some(
      (known) => Math.abs(value - known) <= Math.max(50, known * 0.02)
    )
  );
}

/** Hard ceiling on the reply, so a runaway answer can never fill the card. */
export const MAX_MESSAGE_CHARS = 400;

/** Final gate: length, faithfulness, and no empty answer. */
export function acceptWeeklyMessage(
  raw: string,
  facts: WeeklyMessageFacts
): string | null {
  const text = raw.trim().replace(/^["“”']|["“”']$/g, "").trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_CHARS) return null;
  if (!numbersAreFaithful(text, facts)) return null;
  return text;
}
