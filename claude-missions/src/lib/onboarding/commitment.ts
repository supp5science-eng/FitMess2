import type { GoalType, Sex } from "@/lib/types/db";

/** Serbian month names in the genitive (used after a day number: "14. oktobra"). */
const MONTHS_GENITIVE_SR = [
  "januara",
  "februara",
  "marta",
  "aprila",
  "maja",
  "juna",
  "jula",
  "avgusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

/** e.g. `14. oktobra`. */
export function formatSerbianDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS_GENITIVE_SR[date.getMonth()]}`;
}

export interface CommitmentInput {
  goal: GoalType;
  sex: Sex | null;
  weightKg: number;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
}

export interface Commitment {
  /** Muted lead-in, e.g. "Posvećen sam svom cilju da". */
  intro: string;
  /** Bold focus, e.g. "smršam 6 kg do 14. oktobra". */
  emphasis: string;
  /** Muted second line (the pledge). */
  pledge: string;
}

/**
 * Builds the end-of-questionnaire commitment sentence from the collected data.
 * Weight delta and target date are derived from what the user already entered
 * (current vs target weight, today + timeframe). Serbian, informal, gendered by
 * `sex`; weight-change goals get the "X kg do <datum>" phrasing, maintain/tone
 * get a number-free goal-specific line.
 */
export function buildCommitment(
  input: CommitmentInput,
  now: Date = new Date()
): Commitment {
  const female = input.sex === "female";
  const intro = `${female ? "Posvećena" : "Posvećen"} sam svom cilju da`;
  const pledge = `Pratiću obroke, hraniću telo sa namerom i držaću sebe ${
    female ? "odgovornom" : "odgovornim"
  }.`;

  const emphasis = buildEmphasis(input, now);
  return { intro, emphasis, pledge };
}

function buildEmphasis(input: CommitmentInput, now: Date): string {
  const { goal, weightKg, targetWeightKg, timeframeWeeks } = input;

  if (
    (goal === "lose" || goal === "gain") &&
    targetWeightKg !== null &&
    timeframeWeeks !== null
  ) {
    const delta = Math.abs(Math.round(weightKg - targetWeightKg));
    if (delta > 0) {
      const targetDate = new Date(
        now.getTime() + timeframeWeeks * 7 * 24 * 60 * 60 * 1000
      );
      const verb = goal === "lose" ? "smršam" : "nabacim";
      return `${verb} ${delta} kg do ${formatSerbianDate(targetDate)}`;
    }
  }

  if (goal === "gain") return "izgradim čistu mišićnu masu";
  if (goal === "tone") return "se izvajam i zategnem";
  if (goal === "lose") return "dođem do svoje forme";
  return "zadržim svoju težinu i navike";
}
