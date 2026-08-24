import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_VERSION } from "../app-version";

/**
 * The version guard.
 *
 * `APP_VERSION` is the one place the product's version is written, but three
 * files cannot import it: `package.json` (read by npm), the Android
 * `versionName` and the iOS `MARKETING_VERSION` (both read by the stores, both
 * plain text nobody type-checks). Nothing in the toolchain notices when they
 * drift, and twice already they have — once left the settings screen showing
 * `0.1.0` while the App Store shipped `1.0`, and once a whole bump to 2.0.1 was
 * lost in a merge in silence.
 *
 * So this test does what the compiler cannot: it opens those files and insists
 * they still say what `app-version.ts` says. It fails on the bump, in seconds,
 * naming the file — which is the cheapest possible moment to find out.
 */

const root = join(__dirname, "..", "..", "..");
const read = (...parts: string[]) =>
  readFileSync(join(root, ...parts), "utf8");

describe("APP_VERSION", () => {
  it("is a plain semantic version", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("matches the version in package.json", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(pkg.version).toBe(APP_VERSION);
  });

  it("matches the Android versionName", () => {
    const gradle = read("android", "app", "build.gradle");
    const match = gradle.match(/versionName\s+"([^"]+)"/);
    expect(match?.[1]).toBe(APP_VERSION);
  });

  it("matches every iOS MARKETING_VERSION", () => {
    const pbx = read("ios", "App", "App.xcodeproj", "project.pbxproj");
    const found = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) =>
      m[1].trim()
    );
    // Debug and Release each carry one; both ship the same marketing version.
    expect(found.length).toBeGreaterThan(0);
    for (const version of found) expect(version).toBe(APP_VERSION);
  });
});
