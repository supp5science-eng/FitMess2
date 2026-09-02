/**
 * What positions are worth — while the market is open, when it resolves,
 * and when it is voided.
 *
 * - Open: a position is marked at the current price (net worth, rank).
 * - Resolved: winning shares pay 1, losing shares pay 0. Nothing else.
 * - Voided: nobody won, so everyone gets back what they net spent on that
 *   market (buys minus sells). Not "the entry price" — after several buys
 *   and sells that phrase has no single meaning; net spent does.
 */

import { price, type Pool, type Side } from "./amm";

export type Outcome = "yes" | "no";

export interface Position {
  yes: number;
  no: number;
}

/** Value of a position at the current price. */
export function markToMarket(position: Position, pool: Pool): number {
  return position.yes * price(pool, "yes") + position.no * price(pool, "no");
}

/** Payout at resolution: winning shares are worth 1 each, losing ones 0. */
export function payout(position: Position, outcome: Outcome): number {
  return outcome === "yes" ? position.yes : position.no;
}

export interface TradeRecord {
  userId: string;
  kind: "buy" | "sell";
  side: Side;
  /** Currency the user paid (buy, fee included) or received (sell, after fee). */
  currency: number;
}

/**
 * Refund on a voided market: per user, everything paid in minus everything
 * taken out. A user who sold at a profit before the void keeps that profit
 * (their refund is negative and clamps to zero) — they got out; the market
 * did not owe them anything further.
 */
export function voidRefunds(trades: readonly TradeRecord[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const t of trades) {
    const delta = t.kind === "buy" ? t.currency : -t.currency;
    net.set(t.userId, (net.get(t.userId) ?? 0) + delta);
  }
  for (const [userId, amount] of net) net.set(userId, Math.max(0, amount));
  return net;
}

/** Cash plus every open position marked at its market's current price. */
export function netWorth(
  cash: number,
  positions: readonly { position: Position; pool: Pool }[]
): number {
  return positions.reduce((sum, p) => sum + markToMarket(p.position, p.pool), cash);
}
