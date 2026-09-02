/**
 * A trade as the application sees it: fee applied, both legs quoted, ready
 * to be written to `trades` / `ledger_entries` inside one transaction.
 *
 * The fee exists to sink currency, not to earn it — every account gets a
 * fresh salary monthly, and without a sink the economy only inflates. It is
 * taken from what the trader puts in (buy) or takes out (sell), never from
 * the pool, so the AMM math stays exact.
 */

import { buy, sell, type Pool, type Side } from "./amm";

export const DEFAULT_FEE_RATE = 0.01;

export interface BuyResult {
  kind: "buy";
  side: Side;
  /** What the trader paid in total, fee included. */
  spent: number;
  fee: number;
  shares: number;
  /** Average price paid per share, fee included. */
  avgPrice: number;
  pool: Pool;
  probBefore: number;
  probAfter: number;
}

export interface SellResult {
  kind: "sell";
  side: Side;
  shares: number;
  /** What the trader receives after the fee. */
  received: number;
  fee: number;
  /** Average price received per share, after the fee. */
  avgPrice: number;
  pool: Pool;
  probBefore: number;
  probAfter: number;
}

export function executeBuy(
  pool: Pool,
  side: Side,
  spent: number,
  feeRate: number = DEFAULT_FEE_RATE
): BuyResult {
  assertFeeRate(feeRate);
  if (!(spent > 0)) throw new Error("Spend must be positive");
  const fee = spent * feeRate;
  const q = buy(pool, side, spent - fee);
  return {
    kind: "buy",
    side,
    spent,
    fee,
    shares: q.amount,
    avgPrice: spent / q.amount,
    pool: q.pool,
    probBefore: q.probBefore,
    probAfter: q.probAfter,
  };
}

export function executeSell(
  pool: Pool,
  side: Side,
  shares: number,
  feeRate: number = DEFAULT_FEE_RATE
): SellResult {
  assertFeeRate(feeRate);
  const q = sell(pool, side, shares);
  const fee = q.amount * feeRate;
  const received = q.amount - fee;
  return {
    kind: "sell",
    side,
    shares,
    received,
    fee,
    avgPrice: received / shares,
    pool: q.pool,
    probBefore: q.probBefore,
    probAfter: q.probAfter,
  };
}

function assertFeeRate(rate: number): void {
  if (!(rate >= 0) || !(rate < 1)) throw new Error("Fee rate must be in [0, 1)");
}
