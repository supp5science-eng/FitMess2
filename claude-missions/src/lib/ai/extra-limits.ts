/**
 * Length limits for a written-in extra ("napiši šta si još pojeo/la").
 *
 * Their own module so the "Dodaj još" sheet can enforce them in the input's
 * `maxLength` without importing `extra-estimate.ts` -- that one reaches the
 * Gemini transport (`postJsonPrompt`), which has no business in a client
 * bundle. Same split every prompt module in `lib/ai` observes: schemas and
 * constants may cross to the client, HTTP may not.
 */

/** Long enough for "dve kašike domaćeg ajvara sa malo ulja", short enough that
 * nobody pastes a novel into a prompt. */
export const MAX_EXTRA_DESCRIPTION = 120;
/** "2 kašike", "pola šolje", "otprilike 100 g". */
export const MAX_EXTRA_AMOUNT = 60;
