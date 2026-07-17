import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// F004: Vercel deploy readiness.
//
// AS-007 ("a push to main triggers an automatic production deployment that
// serves the app over HTTPS") is fundamentally a live-infrastructure
// behaviour: it can only be observed by actually pushing a commit and
// watching Vercel's dashboard produce a Production deployment reachable
// over HTTPS. That requires the one-time Vercel-dashboard GitHub repo link
// (OAuth into Vercel, install/authorize the GitHub App, import the repo) --
// a browser-only step no script or CI job can complete on a human's behalf.
// See docs/deploy.md for the full one-time checklist and why it is
// deferred here rather than blocked (missions/20260717-183157/handoffs/
// F004-handoff.md has the status rationale).
//
// What *is* testable from inside the repo is every code-side precondition
// for that deploy to succeed once the dashboard link exists: correct Node
// runtime pinning, the presence and completeness of the deploy runbook, and
// (elsewhere, via a manual build run recorded in the handoff) that
// `next build` succeeds with zero environment variables set. This suite
// covers the former; it is deliberately narrow and does not claim to prove
// AS-007 itself.

const ROOT = path.resolve(__dirname, "..", "..", "..");

describe("F004: Vercel deploy readiness (code-side preconditions for AS-007)", () => {
  it("test_AS_007_readiness_package_json_pins_node_22_via_engines", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")
    );
    expect(pkg.engines?.node).toMatch(/^22\b/);
  });

  it("test_AS_007_readiness_nvmrc_pins_node_22_matching_vercel_default_runtime", () => {
    const nvmrc = fs
      .readFileSync(path.join(ROOT, ".nvmrc"), "utf-8")
      .trim();
    expect(nvmrc).toMatch(/^22\b/);
  });

  it("test_AS_007_readiness_build_script_is_the_standard_next_build_vercel_autodetects", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")
    );
    expect(pkg.scripts?.build).toBe("next build");
  });

  it("test_AS_007_readiness_deploy_runbook_exists_documenting_the_one_time_dashboard_link_step", () => {
    const deployDocPath = path.join(ROOT, "docs", "deploy.md");
    expect(fs.existsSync(deployDocPath)).toBe(true);

    const content = fs.readFileSync(deployDocPath, "utf-8");
    expect(content).toMatch(/AS-007/);
    expect(content.toLowerCase()).toMatch(/import the github repo/);
  });

  it("test_AS_007_readiness_deploy_runbook_lists_every_env_var_name_present_in_env_example", () => {
    const deployDocContent = fs.readFileSync(
      path.join(ROOT, "docs", "deploy.md"),
      "utf-8"
    );
    const envExampleContent = fs.readFileSync(
      path.join(ROOT, ".env.example"),
      "utf-8"
    );

    const envExampleKeys = envExampleContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.slice(0, line.indexOf("=")).trim())
      .filter(Boolean);

    expect(envExampleKeys.length).toBeGreaterThan(0);

    const missingFromRunbook = envExampleKeys.filter(
      (key) => !deployDocContent.includes(key)
    );
    expect(missingFromRunbook).toEqual([]);
  });

  it("test_AS_007_readiness_no_speculative_vercel_json_committed_before_it_is_needed", () => {
    // Per clarified scope: only add vercel.json when something concrete
    // needs it (e.g. crons in F045/F057/F071). An empty/speculative file
    // now would be dead config.
    expect(fs.existsSync(path.join(ROOT, "vercel.json"))).toBe(false);
  });
});
