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
  /** Muted lead-in, e.g. "Obećavam sebi da ću". */
  intro: string;
  /** Bold focus, e.g. "smršati 6 kg do 14. oktobra". */
  emphasis: string;
  /** Warm, first-person pledge (the "opening up to yourself" line). */
  pledge: string;
}

/**
 * Builds the end-of-questionnaire commitment from the collected data. Weight
 * delta and target date are derived from what the user already entered (current
 * vs target weight, today + timeframe). Serbian, informal, gendered by `sex`,
 * and deliberately warm/first-person ("choosing myself"): weight-change goals
 * get the "X kg do <datum>" phrasing, maintain/tone a number-free goal line.
 */
export function buildCommitment(
  input: CommitmentInput,
  now: Date = new Date()
): Commitment {
  const female = input.sex === "female";
  const intro = "Obećavam sebi da ću";
  const pledge = `Biram sebe — ovog puta do kraja. Ješću sa namerom, biću ${
    female ? "iskrena" : "iskren"
  } prema sebi i neću odustati kad bude teško.`;

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
      const verb = goal === "lose" ? "smršati" : "nabaciti";
      return `${verb} ${delta} kg do ${formatSerbianDate(targetDate)}`;
    }
  }

  if (goal === "gain") return "izgraditi jaču verziju sebe";
  if (goal === "tone") return "izvajati i zategnuti svoje telo";
  if (goal === "lose") return "doći do svoje najbolje forme";
  return "ostati veran svojim navikama i formi";
}
