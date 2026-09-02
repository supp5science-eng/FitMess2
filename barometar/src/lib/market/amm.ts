/**
 * AMM — the "kiosk" that always quotes a price.
 *
 * Constant-product market maker with a probability weight, the same design
 * Manifold uses ("Maniswap"): a market holds a pool of YES and NO shares and
 * the invariant `yes^p * no^(1-p) = k` is preserved by every trade. `p` is
 * the probability the creator opened the market at; with an equal seed on
 * both sides the quoted probability is exactly `p`.
 *
 * A share pays 1 unit of currency if its side wins and 0 otherwise, so the
 * price of a YES share IS the market's probability. Buying pushes the price
 * toward 1, selling toward 0, and neither is ever reached.
 *
 * Selling is implemented the Manifold way: to sell `s` YES shares you buy
 * exactly `s` NO shares, which leaves you holding `s` matched YES+NO pairs,
 * and a pair is always worth exactly 1. Your proceeds are `s` minus what the
 * NO shares cost. The platform is the only liquidity provider and absorbs the
 * difference — the currency is ours, that is fine. See
 * `claude-missions/docs/barometar.md`, "Trgovanje".
 *
 * Everything here is pure. No I/O, no rounding for display — callers round.
 */

export type Side = "yes" | "no";

export interface Pool {
  /** YES shares held by the pool. */
  yes: number;
  /** NO shares held by the pool. */
  no: number;
  /** Probability weight in (0, 1); the opening probability with an equal seed. */
  p: number;
}

export interface Quote {
  /** Shares the trader receives (buy) or currency they receive (sell). */
  amount: number;
  pool: Pool;
  probBefore: number;
  probAfter: number;
}

const EPSILON = 1e-9;

export function assertValidPool(pool: Pool): void {
  if (!(pool.yes > 0) || !(pool.no > 0)) {
    throw new Error("Pool must hold a positive amount of both YES and NO");
  }
  if (!(pool.p > 0) || !(pool.p < 1)) {
    throw new Error("Pool weight p must be strictly between 0 and 1");
  }
}

/** `yes^p * no^(1-p)` — the quantity every trade preserves. */
export function invariant(pool: Pool): number {
  return Math.pow(pool.yes, pool.p) * Math.pow(pool.no, 1 - pool.p);
}

/** Current probability of YES, i.e. the price of one YES share. */
export function probability(pool: Pool): number {
  const { yes, no, p } = pool;
  return (p * no) / (p * no + (1 - p) * yes);
}

/** Price of one share of `side` right now. */
export function price(pool: Pool, side: Side): number {
  const prob = probability(pool);
  return side === "yes" ? prob : 1 - prob;
}

/**
 * Opens a market: the platform seeds both sides with `liquidity` shares and
 * the quoted probability starts at `initialProb`. Bigger liquidity = a trade
 * of a given size moves the price less.
 */
export function seedPool(liquidity: number, initialProb: number): Pool {
  if (!(liquidity > 0)) throw new Error("Seed liquidity must be positive");
  const pool = { yes: liquidity, no: liquidity, p: initialProb };
  assertValidPool(pool);
  return pool;
}

/**
 * Spend `amount` of currency on `side`. The currency enters the pool as
 * both YES and NO shares (a unit of currency is one matched pair); the pool
 * then releases as many `side` shares as the invariant allows.
 */
export function buy(pool: Pool, side: Side, amount: number): Quote {
  assertValidPool(pool);
  if (!(amount > 0)) throw new Error("Buy amount must be positive");
  const k = invariant(pool);
  const { p } = pool;
  const y = pool.yes + amount;
  const n = pool.no + amount;
  const probBefore = probability(pool);

  let next: Pool;
  let shares: number;
  if (side === "yes") {
    const newYes = Math.pow(k / Math.pow(n, 1 - p), 1 / p);
    shares = y - newYes;
    next = { yes: newYes, no: n, p };
  } else {
    const newNo = Math.pow(k / Math.pow(y, p), 1 / (1 - p));
    shares = n - newNo;
    next = { yes: y, no: newNo, p };
  }
  return { amount: shares, pool: next, probBefore, probAfter: probability(next) };
}

/**
 * How much currency buys exactly `shares` of `side`. Monotone in the amount,
 * so a bisection on `buy` finds it; 80 halvings put the error far below any
 * unit anyone will ever display.
 */
export function costToBuyShares(pool: Pool, side: Side, shares: number): number {
  assertValidPool(pool);
  if (!(shares > 0)) throw new Error("Shares must be positive");
  // A share never costs more than 1, so `shares` currency always suffices.
  let lo = 0;
  let hi = shares;
  while (buy(pool, side, hi).amount < shares) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) break;
    if (buy(pool, side, mid).amount < shares) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Sell `shares` of `side` back to the kiosk: buy the same number of the
 * opposite side, redeem the matched pairs at 1 each. `amount` in the result
 * is the currency the seller walks away with.
 */
export function sell(pool: Pool, side: Side, shares: number): Quote {
  assertValidPool(pool);
  if (!(shares > 0)) throw new Error("Sell shares must be positive");
  const opposite: Side = side === "yes" ? "no" : "yes";
  const cost = costToBuyShares(pool, opposite, shares);
  const after = buy(pool, opposite, cost);
  const proceeds = Math.max(0, shares - cost);
  return {
    amount: proceeds < EPSILON ? 0 : proceeds,
    pool: after.pool,
    probBefore: after.probBefore,
    probAfter: after.probAfter,
  };
}
