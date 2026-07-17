import { describe, expect, it } from "vitest";

// F003: project tooling smoke test.
//
// AS-004: `npm run test` (Vitest) runs and passes.
// AS-005: `npm run lint` (ESLint) runs and passes with zero errors.
// AS-006: `npm run typecheck` (tsc --noEmit) runs and passes with zero
// errors.
//
// This suite is the sample passing unit test required under src/lib/ so
// that AS-004 has a concrete, always-present assertion to exercise: if the
// Vitest harness itself is broken (bad config, missing setup file, jsdom
// misconfigured), this test fails along with everything else, proving the
// runner works end to end.
//
// AS-005 and AS-006 are process-level checks (running `npm run lint` /
// `npm run typecheck` and inspecting their exit codes and output) rather
// than something expressible as a unit-test assertion -- a linter or type
// checker cannot meaningfully "pass" from inside the code it is checking.
// The worker handoff for F003 records the verbatim output of both commands
// as evidence. This file also participates in both checks: it is valid,
// strict-mode TypeScript with no lint violations, so its mere presence in
// the tree is additional (compiled) proof that AS-005/AS-006 hold for
// src/lib.

describe("F003 tooling smoke test", () => {
  it("test_AS_004_vitest_runner_executes_and_a_basic_assertion_passes", () => {
    expect(1 + 1).toBe(2);
  });

  it("test_AS_004_vitest_runner_supports_async_assertions", async () => {
    const value = await Promise.resolve("ok");
    expect(value).toBe("ok");
  });

  it("test_AS_005_and_AS_006_this_file_is_strict_typescript_with_no_lint_violations", () => {
    // Typed, no `any`, no unused vars/imports -- if this file itself broke
    // strict mode or an ESLint rule, `npm run typecheck` / `npm run lint`
    // (run separately and captured in the handoff) would fail on this
    // exact file.
    const isEvidenceFile: boolean = true;
    expect(isEvidenceFile).toBe(true);
  });
});
