/**
 * The streak's warm accent -- amber -> orange, light to dark. Deliberately its
 * own colour, distinct from the app's teal (calories), violet (koraci) and sky
 * (voda) feature accents, so "niz" reads as its own thing: fire. Same
 * per-feature-gradient convention the Koraci/Voda progress rings already use
 * (`steps-card.tsx`'s `STEPS_GRADIENT`), fed into the shared `ProgressRing`.
 */
export const FLAME_GRADIENT: [string, string, string] = [
  "#fbbf24", // amber-400
  "#fb923c", // orange-400
  "#f97316", // orange-500
];
