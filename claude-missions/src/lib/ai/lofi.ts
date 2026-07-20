import { computeDayTotals, computeRemaining } from "@/lib/home/totals";
import type { GoalType, Log, Target } from "@/lib/types/db";

// M6 (Lofi agent): Lofi is FitMess's in-app food buddy. You chat with it the
// way you'd text a friend who knows food -- "stojim u prodavnici, imam 500
// dinara, šta da uzmem?" -- and it answers using YOUR live daily budget (how
// many kcal + macros you have left today) plus your goal. This file owns
// everything provider-agnostic about Lofi: the persona/system prompt, the
// daily-budget snapshot fed into it, the opening line, and the starter chips.
// The actual Gemini call lives in `gemini.ts`; the server action wires them.

/** The lightweight, display-ready view of "where the user stands today" that
 * both the header strip and Lofi's system prompt are built from. */
export interface LofiSnapshot {
  /** False when the user has no target row yet (pre-onboarding edge). */
  hasTarget: boolean;
  targetKcal: number;
  consumedKcal: number;
  /** Whole kcal left today; 0 once over budget. */
  remainingKcal: number;
  isOver: boolean;
  /** Whole kcal past the target; 0 while under. */
  overshootKcal: number;
  /** Grams still available today per macro (never negative). */
  remaining: { protein: number; carbs: number; fat: number };
  target: { protein: number; carbs: number; fat: number };
  goal: GoalType | null;
  mealsLogged: number;
}

const EMPTY_SNAPSHOT: LofiSnapshot = {
  hasTarget: false,
  targetKcal: 0,
  consumedKcal: 0,
  remainingKcal: 0,
  isOver: false,
  overshootKcal: 0,
  remaining: { protein: 0, carbs: 0, fat: 0 },
  target: { protein: 0, carbs: 0, fat: 0 },
  goal: null,
  mealsLogged: 0,
};

const clampG = (n: number) => Math.max(0, Math.round(n));

/**
 * Pure: folds the user's newest target row + today's logs into a snapshot.
 * Reuses the exact same arithmetic the `/danas` ring uses (`computeDayTotals`
 * + `computeRemaining`), so the number Lofi reasons about is byte-for-byte the
 * number the home screen shows -- no second source of truth.
 */
export function buildLofiSnapshot(
  target: Target | null,
  logs: Pick<Log, "kcal" | "protein" | "carbs" | "fat">[]
): LofiSnapshot {
  if (!target) return { ...EMPTY_SNAPSHOT, mealsLogged: logs.length };

  const totals = computeDayTotals(logs);
  const { remainingKcal, isOver, overshootKcal } = computeRemaining(
    totals.kcal,
    target.daily_kcal
  );

  return {
    hasTarget: true,
    targetKcal: Math.round(target.daily_kcal),
    consumedKcal: Math.round(totals.kcal),
    remainingKcal,
    isOver,
    overshootKcal,
    remaining: {
      protein: clampG(target.protein_g - totals.protein),
      carbs: clampG(target.carbs_g - totals.carbs),
      fat: clampG(target.fat_g - totals.fat),
    },
    target: {
      protein: Math.round(target.protein_g),
      carbs: Math.round(target.carbs_g),
      fat: Math.round(target.fat_g),
    },
    goal: target.goal,
    mealsLogged: logs.length,
  };
}

const GOAL_LABEL: Record<GoalType, string> = {
  maintain: "održavanje težine (jede na nivou potrošnje)",
  lose: "mršavljenje (kalorijski deficit)",
  gain: "dobijanje mišićne mase (kalorijski suficit)",
  tone: "zatezanje / rekompozicija (blagi deficit, naglasak na proteine)",
};

/** The data block appended to Lofi's persona so every reply is grounded in the
 * user's real, current numbers. */
function snapshotForPrompt(snapshot: LofiSnapshot, name: string | null): string {
  const lines: string[] = [];
  lines.push(`Ime korisnika: ${name?.trim() || "nepoznato (oslovljavaj ga prijateljski, bez imena)"}`);

  if (!snapshot.hasTarget) {
    lines.push(
      "Korisnik još NIJE podesio dnevni plan (cilj/budžet), pa nemaš njegove brojke. Pomozi mu opšte i, ako zatreba, nežno predloži da završi podešavanje plana."
    );
    return lines.join("\n");
  }

  lines.push(
    `Cilj: ${snapshot.goal ? GOAL_LABEL[snapshot.goal] : "nije postavljen"}`
  );
  lines.push(`Dnevni budžet: ${snapshot.targetKcal} kcal`);
  lines.push(`Danas pojedeno: ${snapshot.consumedKcal} kcal (${snapshot.mealsLogged} obroka uneto)`);
  if (snapshot.isOver) {
    lines.push(
      `PREKORAČENJE: prešao je dnevni budžet za ~${snapshot.overshootKcal} kcal. Budi smiren i bez osuđivanja — jedan dan ne ruši nedelju. Predloži lagane opcije ili da ostavi za sutra.`
    );
  } else {
    lines.push(`OSTALO danas: ${snapshot.remainingKcal} kcal`);
  }
  lines.push(
    `Makroi koji su OSTALI danas (grami): proteini ~${snapshot.remaining.protein} g, ugljeni hidrati ~${snapshot.remaining.carbs} g, masti ~${snapshot.remaining.fat} g.`
  );
  lines.push(
    `Dnevni ciljevi makroa (grami): proteini ${snapshot.target.protein} g, UH ${snapshot.target.carbs} g, masti ${snapshot.target.fat} g.`
  );
  return lines.join("\n");
}

/**
 * Builds Lofi's full system instruction: a fixed persona + the live snapshot.
 * Kept here (not in the component) so the persona is versioned with the code
 * and unit-testable.
 */
export function buildLofiSystemPrompt(
  snapshot: LofiSnapshot,
  name: string | null
): string {
  return `Ti si "Lofi" — opušten, topao pomoćnik za ishranu unutar aplikacije FitMess (srpsko tržište).
Zamisli da ti korisnik piše kao dobrom drugaru koji se razume u hranu: stoji u prodavnici ili razmišlja šta da jede i traži savet.

TVOJA ULOGA:
- Pomažeš korisniku da odluči ŠTA DA JEDE tako da se uklopi u: (1) budžet u parama (dinari), (2) šta mu se jede (slano/slatko, brzo, lagano…), (3) koliko mu je kalorija i makroa OSTALO danas, i (4) njegov cilj.
- Konkretni predlozi: daj 2–4 opcije, kratke crtice. Za svaku daj GRUBU procenu kcal i, kad je bitno, protein/UH/mast, i po potrebi grubu cenu u dinarima.
- Realni proizvodi i lanci kod nas (Maxi, Lidl, IDEA, Univerexport, Aman, pekare, marketi). Balkanska/srpska hrana.

STIL:
- Srpski, latinica, "ti" forma. Toplo, kratko, ljudski — kao drugar, ne kao robot ni nutricionista koji drži predavanje.
- Skenljivo: kratke rečenice, crtice (-) za liste, **podebljaj** naziv proizvoda ili ključnu brojku. Bez ogromnih blokova teksta.
- 1–2 emodžija maksimalno, samo kad prirodno legne. Nikad detinjasto.
- NIKAD ne osuđuj i ne plaši kalorijama. Ako je korisnik prekoračio budžet — smiri ga, jedan dan ne ruši nedelju.

VAŽNO O TAČNOSTI:
- Nutritivne vrednosti i cene su PROCENE — reci "otprilike"/"~", ne glumi da su egzaktne. Cene variraju po prodavnici.
- Ako ti fali ključna informacija (koliko para ima, šta mu se jede), pitaj KRATKO jedno pitanje pre nego što nagađaš.
- Uklapaj predloge u OSTATAK budžeta i makroa (dole). Ako mu fali proteina — gurni protein; ako je pri kraju sa kalorijama — lagane opcije.
- Ostani u temi hrane, obroka, kupovine namirnica i ishrane. Ako pita nešto sasvim nevezano, ljubazno vrati razgovor na hranu.
- Ne izmišljaj da si već nešto zabeležio u aplikaciju — ti samo savetuješ; unos obroka korisnik radi sam kroz "+".

KONTEKST KORISNIKA (uživo, danas):
${snapshotForPrompt(snapshot, name)}`;
}

/** Lofi's opening message, shown as the first bubble before any user turn. */
export const LOFI_GREETING =
  "Ćao, ja sam **Lofi** 👋 tvoj pomoćnik za obroke.\n\nReci mi šta ti se jede, koliko para imaš ili šta ti je ostalo u planu — pa da smislimo nešto zajedno.";

/** Starter chips shown on the empty chat, to seed the first message. */
export const LOFI_SUGGESTIONS: readonly string[] = [
  "Stojim u prodavnici, imam 500 din — šta da uzmem?",
  "Gladan sam, šta mi se uklapa u ostatak dana?",
  "Treba mi još proteina, predloži nešto",
  "Nešto slatko a da ne preteram?",
  "Brz i jeftin ručak ideja",
] as const;
