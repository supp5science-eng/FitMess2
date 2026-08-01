/**
 * Day trust (2026-08-01): does a past day's logged total deserve to move the
 * plan?
 *
 * The adaptive plan used to read `logs` as ground truth: a Tuesday holding a
 * single 122 kcal entry was arithmetically identical to a real 122 kcal day.
 * It is not. The overwhelmingly common failure mode is food that reached the
 * stomach but never reached the app -- self-reported intake is under-reported
 * by roughly 20-30% on average in doubly-labelled-water validation studies
 * (Livingstone & Black, J Nutr 2003), and the gap widens with body mass. A
 * plan that silently believes the log punishes people for forgetting, and --
 * worse, on `gain`/`maintain` -- orders a feast to "make up" food already
 * eaten.
 *
 * So the rule this module enforces:
 *
 *   Absence of data is not data. A day we cannot vouch for is counted as
 *   ON PLAN (contributing nothing in either direction), never as its logged
 *   number, and the user is told which days were left out.
 *
 * The plausibility test is the standard one from nutrition epidemiology: the
 * ratio of reported intake to BMR (the Goldberg cutoff -- Goldberg et al.,
 * Eur J Clin Nutr 1991; Black, Int J Obes 2000). Intake below BMR for a whole
 * day is physiologically possible but rare enough to be worth questioning;
 * that single, non-arbitrary threshold is the whole detector.
 *
 * Nothing here does I/O, and nothing here decides on its own: an ambiguous day
 * produces a QUESTION (`needsAnswer`), and the user's answer -- carried in the
 * `fm_dani` cookie -- always wins over the heuristic.
 */

import { KCAL_FLOOR } from "@/lib/budget/engine";
import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Sex } from "@/lib/types/db";

/** How a day's logged total is read by the redistribution math. */
export type DayTrust =
  /** Plausible full day -- its real number feeds the plan. */
  | "trusted"
  /** Something was logged, but too little to be a whole day's food. */
  | "incomplete"
  /** Nothing was logged at all. */
  | "empty";

/**
 * The user's own verdict on a flagged day, which overrides the heuristic.
 * `complete` = "it really was a light day"; `partial` = "I didn't log it all".
 */
export type DayAnswer = "complete" | "partial";

export interface DayIntake {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Total kcal logged that day. */
  kcal: number;
  /** How many log rows landed on that day. */
  logCount: number;
}

export interface DayVerdict extends DayIntake {
  trust: DayTrust;
  /** True when this day's own kcal feeds the redistribution math. */
  counts: boolean;
  /** True when the card should ask the user about this day. */
  needsAnswer: boolean;
  /** The answer already on file, if any. */
  answer: DayAnswer | null;
}

/** Cookie holding the user's answers, newest-wins, pruned by the writer. */
export const DAY_ANSWER_COOKIE = "fm_dani";

/** Answers older than this stop mattering -- the plan only looks 2 weeks back. */
export const DAY_ANSWER_KEEP_DAYS = 21;

/**
 * The kcal line below which a whole day's log is treated as incomplete.
 *
 * BMR when we can compute it (the Goldberg posture: a day under basal
 * expenditure is the flag). When the profile is missing the numbers BMR needs,
 * we fall back to the app's own sex-specific safety floor -- the same
 * 1400/1200 the budget engine already refuses to plan below, which is the
 * closest thing to "physiologically minimal" we have without a full profile.
 */
export function plausibilityFloor(
  bmrKcal: number | null | undefined,
  sex: Sex
): number {
  if (bmrKcal != null && Number.isFinite(bmrKcal) && bmrKcal > 0) {
    return Math.round(bmrKcal);
  }
  return KCAL_FLOOR[sex] ?? KCAL_FLOOR.male;
}

/** Buckets raw logs into per-day totals AND counts, in Belgrade days. */
export function bucketDayIntake(
  logs: readonly { logged_at: string; kcal: number }[]
): Map<string, DayIntake> {
  const byDay = new Map<string, DayIntake>();
  for (const log of logs) {
    const dayKey = toBelgradeCalendarDay(new Date(log.logged_at));
    const current = byDay.get(dayKey);
    if (current) {
      current.kcal += log.kcal;
      current.logCount += 1;
    } else {
      byDay.set(dayKey, { dayKey, kcal: log.kcal, logCount: 1 });
    }
  }
  for (const day of byDay.values()) {
    day.kcal = Math.round(day.kcal);
  }
  return byDay;
}

/**
 * Judges one past day.
 *
 * An `empty` day is never questioned: "did you eat nothing on Tuesday?" is a
 * question whose answer everyone already knows, and asking it would turn the
 * card into a chore. It is simply left out of the math. Only the genuinely
 * ambiguous case -- some food logged, but less than a body burns at rest --
 * earns a question.
 */
export function classifyDay(
  intake: DayIntake,
  floorKcal: number,
  answer: DayAnswer | null = null
): DayVerdict {
  if (answer === "complete") {
    return { ...intake, trust: "trusted", counts: true, needsAnswer: false, answer };
  }
  if (answer === "partial") {
    return {
      ...intake,
      trust: intake.logCount === 0 ? "empty" : "incomplete",
      counts: false,
      needsAnswer: false,
      answer,
    };
  }

  if (intake.logCount === 0) {
    return { ...intake, trust: "empty", counts: false, needsAnswer: false, answer: null };
  }
  if (intake.kcal < floorKcal) {
    return {
      ...intake,
      trust: "incomplete",
      counts: false,
      needsAnswer: true,
      answer: null,
    };
  }
  return { ...intake, trust: "trusted", counts: true, needsAnswer: false, answer: null };
}

// ---------------------------------------------------------------------
// Answer cookie (`fm_dani`)
// ---------------------------------------------------------------------
//
// Format: `YYYY-MM-DD~c,YYYY-MM-DD~p` -- day key, tilde, one letter. Short
// enough that a few weeks of answers stay well inside a cookie, and trivially
// parseable on both server and client. Anything malformed is dropped rather
// than throwing: a corrupted cookie must never break the dashboard.

const ANSWER_CODE: Record<DayAnswer, string> = { complete: "c", partial: "p" };
const CODE_ANSWER: Record<string, DayAnswer> = { c: "complete", p: "partial" };

export function parseDayAnswers(raw: string | null | undefined): Map<string, DayAnswer> {
  const answers = new Map<string, DayAnswer>();
  if (!raw) return answers;
  for (const part of raw.split(",")) {
    const [dayKey, code] = part.split("~");
    if (!dayKey || !code) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    const answer = CODE_ANSWER[code];
    if (answer) answers.set(dayKey, answer);
  }
  return answers;
}

export function serializeDayAnswers(answers: Map<string, DayAnswer>): string {
  return [...answers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, answer]) => `${dayKey}~${ANSWER_CODE[answer]}`)
    .join(",");
}

/**
 * Adds one answer to the cookie value, dropping entries older than
 * `DAY_ANSWER_KEEP_DAYS` so the cookie can never grow without bound.
 */
export function withDayAnswer(
  raw: string | null | undefined,
  dayKey: string,
  answer: DayAnswer,
  today: string
): string {
  const answers = parseDayAnswers(raw);
  answers.set(dayKey, answer);

  const cutoff = new Date(`${today}T12:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - DAY_ANSWER_KEEP_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  for (const key of [...answers.keys()]) {
    if (key < cutoffKey) answers.delete(key);
  }
  return serializeDayAnswers(answers);
}
