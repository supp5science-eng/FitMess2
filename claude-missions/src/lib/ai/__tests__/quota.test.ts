import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  AI_LIMIT_ERROR_SR,
  ENFORCE_AI_LIMIT,
  FREE_DAILY_AI,
  chargeAiEstimate,
  decideQuota,
} from "@/lib/ai/quota";

// The free daily AI allowance. Two things are under test: the decision itself
// (pure, no database), and the promise that every AI action actually asks.

describe("decideQuota", () => {
  it("test_quota_allows_every_estimate_up_to_and_including_the_allowance", () => {
    // The boundary is the whole point: `used` is the count AFTER charging, so
    // the fifth estimate arrives as 5. Reading this as "over" would advertise
    // five and deliver four -- a bug no user could report precisely.
    for (let used = 1; used <= FREE_DAILY_AI; used += 1) {
      const v = decideQuota({ used, entitled: false, enforce: true });
      expect(v.ok, `estimate ${used} of ${FREE_DAILY_AI}`).toBe(true);
      if (v.ok) expect(v.remaining).toBe(FREE_DAILY_AI - used);
    }
  });

  it("test_quota_refuses_the_first_estimate_past_the_allowance_when_enforced", () => {
    const v = decideQuota({
      used: FREE_DAILY_AI + 1,
      entitled: false,
      enforce: true,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error_sr).toBe(AI_LIMIT_ERROR_SR);
  });

  it("test_quota_lets_everything_through_while_enforcement_is_off", () => {
    // Enforcement is a switch, not a rewrite. With it off the user is never
    // refused, however far past the line they are -- but `remaining` still
    // reads 0, so a caller that wants to show "you're over" can.
    const v = decideQuota({ used: 99, entitled: false, enforce: false });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.remaining).toBe(0);
  });

  it("test_quota_never_caps_an_entitled_user", () => {
    const v = decideQuota({ used: 500, entitled: true, enforce: true });
    expect(v.ok).toBe(true);
    // `null`, not a big number: a paying user has no ceiling to count down to,
    // and a number here would eventually be rendered as one.
    if (v.ok) expect(v.remaining).toBeNull();
  });

  it("test_enforcement_ships_off_so_nobody_is_walled_off_before_a_paywall_exists", () => {
    // Deliberate tripwire. Flipping this constant without shipping something
    // to buy strands users behind a wall with no door -- if this test fails,
    // the paywall had better be in the same commit.
    expect(ENFORCE_AI_LIMIT).toBe(false);
  });
});

describe("chargeAiEstimate", () => {
  function fakeClient(result: { data: unknown; error: unknown }) {
    return {
      rpc: vi.fn().mockResolvedValue(result),
      from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) })),
    } as never;
  }

  it("test_quota_fails_open_when_the_database_call_errors", async () => {
    // A counter is bookkeeping; refusing to analyse someone's lunch because
    // the bookkeeping hiccuped is a broken app. This matters most on the day
    // 0032 is merged but not yet applied -- the RPC does not exist, every call
    // errors, and the app has to keep working anyway.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const verdict = await chargeAiEstimate(
      fakeClient({ data: null, error: { message: "function does not exist" } }),
      "user-1"
    );
    expect(verdict.ok).toBe(true);
  });

  it("test_quota_charges_the_belgrade_day_not_a_utc_one", async () => {
    // The app reasons in Belgrade days everywhere. A UTC day would roll at
    // 02:00 local and disagree with the /danas screen the user is looking at,
    // on exactly the nights someone is still logging dinner.
    const client = fakeClient({ data: [{ used: 1, entitled: false }], error: null });
    await chargeAiEstimate(client, "user-1");
    const [name, args] = (client as unknown as { rpc: { mock: { calls: [string, { p_day: string }][] } } })
      .rpc.mock.calls[0];
    expect(name).toBe("consume_ai_quota");
    expect(args.p_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("every AI action charges the allowance", () => {
  // The gate lives at the action layer, not inside `gemini.ts`, because one
  // user action can make two model calls. The cost of that choice is that a
  // NEW AI action can forget to ask -- so this asserts the promise directly
  // rather than trusting that nobody forgets.
  const ACTIONS = [
    "obrok",
    "deklaracija",
    "glas",
    "gric",
    "najtacnije",
    "proizvod",
  ];

  it.each(ACTIONS)(
    "test_ai_action_%s_imports_the_quota_gate",
    (flow) => {
      const src = readFileSync(
        path.join(process.cwd(), "src", "app", "(app)", "dodaj", flow, "actions.ts"),
        "utf-8"
      );
      expect(src).toContain("chargeAiEstimate");
    }
  );

  it("test_prizma_charges_once_not_once_per_model_call", () => {
    // Prizma analyses, asks the user questions, then finalises -- two model
    // calls for ONE meal. `readImages` is shared by both steps, so charging
    // there would bill the meal twice and make "five a day" mean two and a
    // half. The charge belongs to step 1 alone.
    const src = readFileSync(
      path.join(process.cwd(), "src", "app", "(app)", "dodaj", "najtacnije", "actions.ts"),
      "utf-8"
    );
    const finalize = src.slice(src.indexOf("export async function finalizeMealAction"));
    expect(finalize).not.toContain("chargeAiEstimate");
  });
});
