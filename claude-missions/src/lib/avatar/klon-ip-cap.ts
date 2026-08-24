import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

/**
 * The spend cap on the PUBLIC klon endpoint.
 *
 * Every other paid call in this app is charged to a user id through
 * `consume_ai_quota`. This one has no user: the klon screen sits in front of
 * the questionnaire, before an account exists, which is the whole product
 * decision. So the only thing left to count by is the caller's address.
 *
 * That is a weak identifier and this is not pretending otherwise -- a whole
 * mobile cell can share one, and anyone determined can rent another. It is not
 * access control. It is the difference between "a loop can draw until the card
 * declines" and "a loop gets three, then has to work for it", on a key with
 * billing enabled.
 *
 * Server-only: reads a header and writes with the service key.
 */

/** Klons one address may draw per Belgrade day. */
export const KLON_DAILY_IP_LIMIT = 3;

export const KLON_IP_LIMIT_ERROR_SR =
  "Danas je sa ove veze napravljeno više klonova. Probaj ponovo sutra, ili napravi nalog pa nastavi odatle.";

/**
 * Namespace for the digest. NOT a secret and not treated as one -- it exists so
 * the stored value is a pseudonym rather than an address, which is what keeps
 * this table out of "we collect IP addresses" territory in the privacy policy.
 * Changing it resets every counter, so change it only deliberately.
 */
const HASH_NAMESPACE = "fitmess.klon.ip.v1";

/**
 * The caller's address, hashed. Never returns the raw value to anything.
 *
 * `x-forwarded-for` is a LIST when a request passes through more than one
 * proxy, and the client-controlled entries are at the FRONT -- so trusting
 * `[0]` lets anyone mint a fresh identity per request with one header. Vercel
 * appends the real peer last, so the LAST entry is the one worth counting.
 */
export function hashRequestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const real = headers.get("x-real-ip");

  const candidate =
    (forwarded
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ??
      real?.trim()) ||
    null;

  if (!candidate) return null;
  return createHash("sha256")
    .update(`${HASH_NAMESPACE}:${candidate}`)
    .digest("hex");
}

export type IpCapVerdict =
  | { ok: true }
  | { ok: false; error_sr: string };

/**
 * Count this draw against the address, and say whether it is allowed.
 *
 * Charged BEFORE the model runs, like every other quota in the app: a cap that
 * only counts successes bills the owner for every failure.
 *
 * Fails OPEN when the address cannot be read or the counter write breaks. A cap
 * that cannot count must not become a wall in front of the first screen of the
 * funnel -- losing every new visitor to a broken counter costs more than the
 * handful of drawings it would have stopped, and the same reasoning already
 * governs `chargeAiEstimate`.
 */
export async function chargeKlonIp(
  supabase: SupabaseClient<Database>,
  headers: Headers
): Promise<IpCapVerdict> {
  const ipHash = hashRequestIp(headers);
  if (!ipHash) return { ok: true };

  const day = toBelgradeCalendarDay();

  const { data, error } = await supabase.rpc("consume_klon_ip", {
    p_ip_hash: ipHash,
    p_day: day,
  });

  if (error || typeof data !== "number") {
    console.error("[klon] ip cap failed, failing open:", error);
    return { ok: true };
  }

  return data > KLON_DAILY_IP_LIMIT
    ? { ok: false, error_sr: KLON_IP_LIMIT_ERROR_SR }
    : { ok: true };
}
