/**
 * The free daily AI allowance, alone in a module with no imports.
 *
 * It lives apart from `@/lib/ai/quota` on purpose. That module reaches for
 * `next/headers` to tell which surface a request came from, which makes it
 * server-only — and this number is also quoted in the Terms of Use, a document
 * that has no business being server-bound just to name a number. Splitting the
 * constant out means the promise and the enforcement can never disagree
 * without either file needing to know where the other runs.
 */

/** AI estimates a free account gets per Belgrade day. */
export const FREE_DAILY_AI = 5;
