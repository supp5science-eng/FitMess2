/**
 * Dostignuća (achievements/badges): the pure catalog + evaluation behind the
 * `/dostignuca` screen.
 *
 * Same "money-math" posture as the rest of the app (`src/lib/streak/streak.ts`,
 * `src/lib/week/summary.ts`): no network, no database, no `new Date()` hidden
 * inside. The caller reads a handful of aggregate stats
 * (`src/lib/achievements/read-stats.ts`) and hands them here; this decides,
 * purely, which badges are earned and how close the locked ones are. Nothing
 * about a badge is STORED -- it is always DERIVED from the user's real
 * logs/awards/water/steps, so a deleted meal can never leave a badge behind.
 *
 * Every badge maps to something FitMess actually measures today (the product
 * owner's scope: "samo što app meri sad" -- no aspirational placeholder badges
 * for features that don't exist yet).
 */

/** The aggregate numbers every badge is judged against. Read once, server-side
 * (`getUserStats`), from the user's own rows. */
export interface UserStats {
  /** Consecutive days-with-a-meal ending today/yesterday (grace rule). */
  currentStreak: number;
  /** Longest such run ever seen -- streak badges stay earned once reached. */
  bestStreak: number;
  /** Days that reached a "pun dan" (3 logged meals) -- the `awards` count. */
  fullDays: number;
  /** Total meals logged, all-time. */
  totalMeals: number;
  /** Days the day's kcal landed on the calorie target (see `isGoalHit`). */
  goalDays: number;
  /** Days with any water logged. */
  waterDays: number;
  /** Days with any steps logged. */
  stepDays: number;
}

/** Display order (streak first, like the reference milestones screen). */
export const ACHIEVEMENT_CATEGORIES = [
  "niz",
  "punDan",
  "obroci",
  "kalorije",
  "voda",
  "koraci",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

/** Section labels (sr-Latn). */
export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  niz: "Niz",
  punDan: "Puni dani",
  obroci: "Uneti obroci",
  kalorije: "Kalorijski cilj",
  voda: "Voda",
  koraci: "Koraci",
};

interface AchievementDef {
  id: string;
  category: AchievementCategory;
  /** Which `UserStats` number this badge is measured against. */
  stat: keyof UserStats;
  threshold: number;
  /** Playful Serbian name. */
  title: string;
  /** What it takes, already in the right Serbian form (e.g. "50 obroka"). */
  criteria: string;
}

// The catalog. Thresholds climb within each category; titles are sr-Latn,
// informal, zero-shame. Every `stat` is a real, measurable number.
const CATALOG: AchievementDef[] = [
  // Niz -- longest streak of days with a logged meal.
  { id: "niz-3", category: "niz", stat: "bestStreak", threshold: 3, title: "Zagrevanje", criteria: "3 dana zaredom" },
  { id: "niz-7", category: "niz", stat: "bestStreak", threshold: 7, title: "Cela nedelja", criteria: "7 dana zaredom" },
  { id: "niz-30", category: "niz", stat: "bestStreak", threshold: 30, title: "Mesec u nizu", criteria: "30 dana zaredom" },
  { id: "niz-100", category: "niz", stat: "bestStreak", threshold: 100, title: "Nezaustavljiv", criteria: "100 dana zaredom" },
  { id: "niz-365", category: "niz", stat: "bestStreak", threshold: 365, title: "Legenda", criteria: "365 dana zaredom" },

  // Puni dani -- days that reached three logged meals.
  { id: "pun-1", category: "punDan", stat: "fullDays", threshold: 1, title: "Ceo tanjir", criteria: "1 pun dan" },
  { id: "pun-10", category: "punDan", stat: "fullDays", threshold: 10, title: "Postojan", criteria: "10 punih dana" },
  { id: "pun-50", category: "punDan", stat: "fullDays", threshold: 50, title: "Bez preskoka", criteria: "50 punih dana" },

  // Uneti obroci -- total meals logged, all-time.
  { id: "obrok-1", category: "obroci", stat: "totalMeals", threshold: 1, title: "Prvi unos", criteria: "1 obrok" },
  { id: "obrok-10", category: "obroci", stat: "totalMeals", threshold: 10, title: "Uhvatio ritam", criteria: "10 obroka" },
  { id: "obrok-50", category: "obroci", stat: "totalMeals", threshold: 50, title: "Redovan", criteria: "50 obroka" },
  { id: "obrok-250", category: "obroci", stat: "totalMeals", threshold: 250, title: "Ozbiljan", criteria: "250 obroka" },
  { id: "obrok-500", category: "obroci", stat: "totalMeals", threshold: 500, title: "Šef kuhinje", criteria: "500 obroka" },

  // Kalorijski cilj -- days the day's kcal landed on target (see isGoalHit).
  { id: "kcal-1", category: "kalorije", stat: "goalDays", threshold: 1, title: "U metu", criteria: "1 dan u cilju" },
  { id: "kcal-7", category: "kalorije", stat: "goalDays", threshold: 7, title: "Nedelja u metu", criteria: "7 dana u cilju" },
  { id: "kcal-30", category: "kalorije", stat: "goalDays", threshold: 30, title: "Snajperista", criteria: "30 dana u cilju" },

  // Voda -- days with any water logged.
  { id: "voda-1", category: "voda", stat: "waterDays", threshold: 1, title: "Prva čaša", criteria: "1 dan vode" },
  { id: "voda-10", category: "voda", stat: "waterDays", threshold: 10, title: "Hidriran", criteria: "10 dana vode" },
  { id: "voda-50", category: "voda", stat: "waterDays", threshold: 50, title: "Vodena struja", criteria: "50 dana vode" },

  // Koraci -- days with any steps logged.
  { id: "korak-1", category: "koraci", stat: "stepDays", threshold: 1, title: "Prvi koraci", criteria: "1 dan koraka" },
  { id: "korak-7", category: "koraci", stat: "stepDays", threshold: 7, title: "U pokretu", criteria: "7 dana koraka" },
  { id: "korak-30", category: "koraci", stat: "stepDays", threshold: 30, title: "Šetač", criteria: "30 dana koraka" },
];

/**
 * "Hit the calorie goal" for a single day: the day's consumed kcal landed ON
 * the target -- from 85% up to 110% of it. Under-logging (a single snack) sits
 * below the band and doesn't count; a big overshoot sits above it. Deliberately
 * a forgiving band, not a knife-edge, in keeping with the app's zero-shame tone.
 */
export const GOAL_HIT_MIN_RATIO = 0.85;
export const GOAL_HIT_MAX_RATIO = 1.1;

export function isGoalHit(consumedKcal: number, targetKcal: number): boolean {
  if (targetKcal <= 0 || consumedKcal <= 0) return false;
  const ratio = consumedKcal / targetKcal;
  return ratio >= GOAL_HIT_MIN_RATIO && ratio <= GOAL_HIT_MAX_RATIO;
}

/** A badge with its live earned/progress state folded in. */
export interface Achievement extends AchievementDef {
  /** The user's current value for this badge's stat. */
  value: number;
  /** Has the threshold been reached? */
  earned: boolean;
  /** value / threshold, clamped to [0, 1] -- fills the locked tile's meter. */
  progress: number;
}

/** Fold the user's stats into every badge's earned/progress state, in catalog
 * order. */
export function evaluateAchievements(stats: UserStats): Achievement[] {
  return CATALOG.map((def) => {
    const value = stats[def.stat];
    return {
      ...def,
      value,
      earned: value >= def.threshold,
      progress:
        def.threshold > 0 ? Math.min(1, Math.max(0, value / def.threshold)) : 0,
    };
  });
}

export interface CategoryGroup {
  category: AchievementCategory;
  label: string;
  achievements: Achievement[];
  /** How many of this category's badges are earned. */
  earned: number;
  total: number;
}

/** Group evaluated badges by category, in `ACHIEVEMENT_CATEGORIES` order. */
export function groupByCategory(list: Achievement[]): CategoryGroup[] {
  return ACHIEVEMENT_CATEGORIES.map((category) => {
    const achievements = list.filter((a) => a.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      achievements,
      earned: achievements.filter((a) => a.earned).length,
      total: achievements.length,
    };
  });
}

/** How many badges are earned out of the whole catalog -- the header count. */
export function achievementsSummary(list: Achievement[]): {
  earned: number;
  total: number;
} {
  return {
    earned: list.filter((a) => a.earned).length,
    total: list.length,
  };
}

/** The total number of badges in the catalog (for the header before eval). */
export const TOTAL_ACHIEVEMENTS = CATALOG.length;
