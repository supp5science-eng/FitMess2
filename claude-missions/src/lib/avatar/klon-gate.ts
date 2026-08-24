/**
 * The switch that decides whether a missing klon closes the app.
 *
 * The klon gate is the only wall in this app that stands in front of a
 * FIRST-TIME visitor and depends on someone else's service staying up. That
 * combination is what this file exists for. When the drawing screen moved to
 * the front of the funnel (landing -> "Kreni" -> `/klon` -> `/upitnik`), the
 * blast radius of a Gemini outage changed shape: before, a failure annoyed
 * people who already had accounts; now it closes the door on every new one.
 *
 * So the wall gets an off switch that lives in the environment, not in code:
 * set `KLON_OBAVEZAN=false` in Vercel and the gate stops redirecting within a
 * minute, with no deploy, no build and no code review at 3am. Everything else
 * about the feature keeps working -- the screen still draws klons, still saves
 * them, still sits first in the funnel. Only the "and you may not pass without
 * one" part goes quiet.
 *
 * DEFAULT IS ON, and deliberately so: the product decision is that every
 * account has a klon (2026-08-24), and a switch that defaults to off would
 * quietly undo that the first time someone forgot to set a variable. It takes
 * the exact string "false" to open the gate -- a typo, an empty value, or an
 * unset variable all mean "mandatory", because the failure that costs less is
 * the one where the rule still holds.
 */
export function isKlonRequired(): boolean {
  return process.env.KLON_OBAVEZAN !== "false";
}
