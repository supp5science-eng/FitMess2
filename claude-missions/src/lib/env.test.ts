import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// AS-003: `.env.example` lists every required environment variable with
// placeholder values and no real secrets.
//
// This suite never reads or prints a real secret *value* on a passing run.
// The "no leaked secrets" check below only runs if a local `.env` exists
// (it's gitignored and may be absent in CI), and only ever asserts an
// array of leaked values is empty -- it does not assert equality against
// (and therefore never prints) the secret itself unless the check fails.

const ROOT = path.resolve(__dirname, "..", "..");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");
const DOT_ENV_PATH = path.join(ROOT, ".env");

function readEnvKeys(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean);
}

/** Recursively scans .ts/.tsx source (excluding test files) for `process.env.NAME` references. */
function collectSourceEnvVarNames(dir: string): Set<string> {
  const names = new Set<string>();
  const pattern = /process\.env\.([A-Z0-9_]+)/g;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const isSource = /\.(ts|tsx)$/.test(entry.name);
      const isTest = /\.test\.(ts|tsx)$/.test(entry.name);
      if (!isSource || isTest) continue;

      const content = fs.readFileSync(full, "utf-8");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content))) {
        names.add(match[1]);
      }
    }
  }

  walk(dir);
  return names;
}

describe("AS-003: .env.example completeness and secret safety", () => {
  it("test_AS_003_env_example_file_exists_at_repo_root", () => {
    expect(fs.existsSync(ENV_EXAMPLE_PATH)).toBe(true);
  });

  it("test_AS_003_env_example_has_an_entry_for_every_env_var_referenced_in_source_code", () => {
    const envExampleKeys = new Set(readEnvKeys(ENV_EXAMPLE_PATH));
    const sourceVarNames = collectSourceEnvVarNames(path.join(ROOT, "src"));

    // Guard against the scan itself regressing to "finds nothing" silently.
    expect(sourceVarNames.size).toBeGreaterThan(0);

    const missing = [...sourceVarNames].filter(
      (name) => !envExampleKeys.has(name)
    );
    expect(missing).toEqual([]);
  });

  it("test_AS_003_env_example_has_placeholders_for_every_var_known_so_far_from_env_and_tech_decisions", () => {
    // Cross-referenced against .env's key names and
    // connections/mcp-registry.md's "Non-MCP services" table -- every
    // variable the app is known to need so far, not just the ones already
    // referenced by code (Gemini/PostHog/Sentry/VAPID land in later
    // features but must already have placeholders per F002 scope).
    const requiredKeys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "NEXT_PUBLIC_POSTHOG_KEY",
      "NEXT_PUBLIC_POSTHOG_HOST",
      "SENTRY_DSN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "SENTRY_ORG",
      "SENTRY_PROJECT",
      "VAPID_PUBLIC_KEY",
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ];

    const envExampleKeys = new Set(readEnvKeys(ENV_EXAMPLE_PATH));
    const missing = requiredKeys.filter((key) => !envExampleKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("test_AS_003_env_example_contains_no_real_secret_values_from_local_env", () => {
    if (!fs.existsSync(DOT_ENV_PATH)) {
      // No local .env in this environment (e.g. a clean CI checkout) --
      // nothing to compare against. Existence/placeholder checks above
      // already cover the "safe to commit" requirement.
      return;
    }

    const envExampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, "utf-8");
    const realValues = fs
      .readFileSync(DOT_ENV_PATH, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.slice(line.indexOf("=") + 1).trim())
      .filter((value) => value.length > 0);

    // Values that are legitimately public (a fixed cloud host, a public
    // model identifier) and expected to be identical in both files -- not
    // secrets, so exempt from the "must not appear verbatim" check.
    const publicExemptValues = new Set([
      "https://eu.i.posthog.com",
      "gemini-3.5-flash",
    ]);

    const leaked = realValues.filter(
      (value) =>
        !publicExemptValues.has(value) && envExampleContent.includes(value)
    );

    expect(leaked).toEqual([]);
  });
});
