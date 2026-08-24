/**
 * The switch that decides whether a missing klon closes the app.
 *
 * The product decision is that every account has a klon (2026-08-24). This file
 * is about WHEN that rule may start being enforced, which is a different
 * question, and the reason it defaults to OFF:
 *
 * 1. NOT ONE EXISTING ACCOUNT HAS A KLON. The gate does not distinguish new
 *    users from old ones -- it asks `profiles.klon_at IS NULL`, and for every
 *    account that predates this feature the answer is yes. Enforced on the
 *    deploy that ships it, the rule would lock the entire existing user base
 *    out of the app until each of them drew one. A rule that is correct for
 *    tomorrow's users must not be applied retroactively to today's.
 *
 * 2. The screen is now FIRST in the funnel and depends on someone else's
 *    service staying up. Enforcing before a single klon has been drawn against
 *    the live model means betting the whole front door on an untested call.
 *
 * So enforcement is opt-in: set `KLON_OBAVEZAN=true` in the environment once
 * the klon has actually been drawn end-to-end in production. It takes effect
 * within a minute, with no deploy -- and can be switched back just as fast if
 * the image model has a bad day.
 *
 * Everything else works regardless: the screen draws, saves, and sits first in
 * the funnel either way. Only "and you may not pass without one" is gated on
 * this. When it is off, the landing CTA steps back to `/upitnik` too (see
 * `src/app/page.tsx`) -- sending every visitor at a wall we are not yet ready
 * to enforce would be the worst of both.
 */
export function isKlonRequired(): boolean {
  return process.env.KLON_OBAVEZAN === "true";
}
