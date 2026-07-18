import { randomInt } from "node:crypto";

/**
 * F031a: shared collision-safe fixture generator for throwaway 13-digit
 * numeric barcodes (EAN-13 shape) used by live-integration tests that
 * insert rows into `public.foods`, which has a UNIQUE constraint on
 * `barcode`.
 *
 * This replaces the previous ad-hoc pattern seen in several
 * `*.integration.test.ts` files:
 *
 *   const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
 *   const barcode = `3800${suffix}`.slice(0, 13);
 *
 * `Date.now()` is already 13 digits, so prefixing it with a 4-digit brand
 * code and then slicing to 13 characters keeps ONLY a prefix of the
 * millisecond timestamp and silently DROPS the trailing digits of the
 * timestamp as well as the entire random component. The resulting barcode
 * therefore only changes once every ~10 seconds and is not actually
 * randomized at all -- two test runs (or two rows within the same run)
 * executed close together collide on `foods.barcode`'s unique constraint,
 * producing transient failures (and, when a test loops on retrying the
 * insert, occasional multi-minute stalls).
 *
 * `uniqueTestBarcode()` fixes this by combining two independent sources of
 * uniqueness into a fixed-width 13-digit string with NO truncation of
 * either component:
 *
 *   - A monotonically-increasing in-process counter (seeded from a random
 *     offset at module load so different worker/test processes don't all
 *     start at the same value), guaranteeing every call within a single
 *     process/run is unique even if the random component below were ever
 *     to repeat.
 *   - A `node:crypto` random 6-digit component, making collisions between
 *     separate processes/runs (which each get their own counter sequence)
 *     astronomically unlikely.
 *
 * The first digit is always `9`, matching the convention already
 * established by `src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts`'s
 * `makeTestGtin` helper: real seed/OFF-imported EAN-13s in this catalog do
 * not use the `9` prefix range, so test-generated barcodes never collide
 * with real product data either.
 */

const TEST_BARCODE_PREFIX = "9";
const COUNTER_MODULUS = 1_000_000; // 6 digits
const RANDOM_MODULUS = 1_000_000; // 6 digits

// Seeded from crypto randomness at module load so concurrent/short-lived
// processes don't all start counting from 0.
let counter = randomInt(0, COUNTER_MODULUS);

/**
 * Returns a fresh 13-digit numeric string (EAN-13 shape, always prefixed
 * `9`) suitable as a throwaway, collision-safe `foods.barcode` test
 * fixture. Every call -- including repeated calls within the same test
 * file, the same process, or concurrent/successive `npm run test`
 * invocations -- returns a barcode that has not been returned before.
 */
export function uniqueTestBarcode(): string {
  const counterDigits = (counter % COUNTER_MODULUS).toString().padStart(6, "0");
  counter += 1;
  const randomDigits = randomInt(0, RANDOM_MODULUS).toString().padStart(6, "0");
  return `${TEST_BARCODE_PREFIX}${counterDigits}${randomDigits}`;
}
