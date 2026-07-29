/**
 * Share-card tiers -- the "iPhone effect" from the Share-cards PRD (§4).
 *
 * The look of a shared card GROWS with the user's meal-logging streak, and the
 * tier can only ever be EARNED, never bought. That is the whole point: when
 * someone in a story feed sees an Onyx card, the only answer to "how did you
 * get that" is "100 days in a row" -- an aspiration money can't skip. So the
 * tier is derived here, purely, from the streak length (`src/lib/streak`), and
 * on the server from the user's REAL logged days (never a client-sent number),
 * exactly like every other earned signal in the app.
 *
 * Thresholds (PRD §4):
 *   Standard  0–13 days   clean white palette
 *   Silver    14–49 days  silver accent on frame + numbers
 *   Gold      50–99 days  gold accent
 *   Onyx      100+ days   the only dark edition — champagne on black, a badge
 *
 * Pure and framework-free (same "money-math" shape as `streak.ts`): no colours
 * come from CSS custom properties here, because the card is rendered by
 * `next/og` (satori), which cannot read `var(--…)` — it needs concrete hex. The
 * on-screen app keeps using the theme tokens; this palette is the card's own,
 * tuned to sit over a photo on a dark scrim.
 */

/** The four earned looks, ordered by streak length. */
export type ShareTier = "standard" | "silver" | "gold" | "onyx";

/** Lower bound (inclusive) of streak days for each tier, PRD §4. */
export const TIER_MIN_DAYS: Record<ShareTier, number> = {
  standard: 0,
  silver: 14,
  gold: 50,
  onyx: 100,
};

/**
 * The tier a streak of `streakDays` consecutive logged days has earned.
 *
 * Clamps a negative or non-finite input to Standard rather than throwing --
 * the card must always render something, and "no streak" is Standard anyway.
 */
export function tierForStreak(streakDays: number): ShareTier {
  const days = Number.isFinite(streakDays) ? Math.floor(streakDays) : 0;
  if (days >= TIER_MIN_DAYS.onyx) return "onyx";
  if (days >= TIER_MIN_DAYS.gold) return "gold";
  if (days >= TIER_MIN_DAYS.silver) return "silver";
  return "standard";
}

/** The visual signature of one tier, in a form satori can paint directly. */
export interface TierStyle {
  /** Accent for the big kcal figure and the frame (PRD "akcenat na … brojkama"). */
  accent: string;
  /** The inset frame stroke -- the tier's most glanceable signal. */
  frame: string;
  /** Extra darkening laid over the photo. Onyx is "the dark edition", so it
   * pushes the photo down and lets the champagne type carry the card. */
  photoOverlay: string;
  /** Short uppercase mark shown ONLY when non-null. PRD gives a badge to Onyx
   * alone; Silver/Gold earn their accent, not a label. */
  badge: string | null;
  /** Whether this is a dark-edition tier (drives the heavier treatment). */
  dark: boolean;
}

/**
 * Per-tier palette. Kept deliberately restrained (PRD §2 "premium, ne reklama",
 * §8 "svetlo, minimal"): one accent, one frame, nothing loud. Silver is a cool
 * platinum, Gold a warm champagne-gold, Onyx a light champagne on a darkened
 * photo behind a thin gold hairline.
 */
export const TIER_STYLES: Record<ShareTier, TierStyle> = {
  standard: {
    accent: "#ffffff",
    frame: "rgba(255,255,255,0.30)",
    photoOverlay: "rgba(0,0,0,0)",
    badge: null,
    dark: false,
  },
  silver: {
    accent: "#dfe4ea",
    frame: "rgba(214,222,231,0.85)",
    photoOverlay: "rgba(0,0,0,0.04)",
    badge: null,
    dark: false,
  },
  gold: {
    accent: "#eccb7e",
    frame: "rgba(230,196,120,0.90)",
    photoOverlay: "rgba(0,0,0,0.08)",
    badge: null,
    dark: false,
  },
  onyx: {
    accent: "#ece3cf",
    frame: "rgba(201,162,75,0.92)",
    photoOverlay: "rgba(6,7,9,0.42)",
    badge: "ONYX",
    dark: true,
  },
};

/** The style block for a tier -- a tiny convenience over indexing the record. */
export function tierStyle(tier: ShareTier): TierStyle {
  return TIER_STYLES[tier];
}
