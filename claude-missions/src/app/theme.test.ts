import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The "Gravira" theme (2026-08-24) — ONE theme, two inks.
//
// The app used to ship a light/dark pair behind an `fm_theme` cookie. It now
// prints in a single palette: a pale warm paper carrying a vivid ultramarine
// ink, the duotone of an engraved plate. These tests guard the two things that
// are easy to undo by accident:
//
//   1. the palette really is that duotone, and the accent is ONE hue reused at
//      every accent touchpoint rather than a second brand colour creeping in;
//   2. the second theme stays gone — no `.dark` block, no `dark:` variant, no
//      theme class or cookie read in the root layout.
//
// It can't render computed CSS in jsdom (no stylesheet cascade), so it reads
// the source of truth directly. Real visual proof lives in the 375px
// screenshots captured for the re-skin.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS_PATH = path.resolve(HERE, "globals.css");
const LAYOUT_TSX_PATH = path.resolve(HERE, "layout.tsx");
const SRC_DIR = path.resolve(HERE, "..");

const PAPER_HEX = "#ffffff";
const INK_HEX = "#1c1b8f";
const ACCENT_HEX = "#2f2ce6";

const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
const rootBlock = css.match(/^\.light,\n:root\s*{([\s\S]*?)\n}/m)?.[1] ?? "";

/** Every `.ts`/`.tsx`/`.css` file under `src`, for the repo-wide sweeps. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("Gravira theme: warm paper, ultramarine ink", () => {
  it("test_theme_root_defines_the_two_printing_inks", () => {
    expect(rootBlock).toMatch(new RegExp(`--paper:\\s*${PAPER_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--ink:\\s*${INK_HEX}`));
    // The semantic surface/type tokens resolve to those same two inks, so a
    // component reaching for `bg-background`/`text-foreground` lands on the
    // paper and the ink rather than on some third colour.
    expect(rootBlock).toMatch(new RegExp(`--background:\\s*${PAPER_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--foreground:\\s*${INK_HEX}`));
  });

  it("test_theme_primary_is_the_bright_ultramarine_on_paper", () => {
    expect(rootBlock).toMatch(new RegExp(`--primary:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(/--primary-foreground:\s*#ffffff/);
  });

  it("test_theme_same_accent_hue_is_reused_for_ring_and_sidebar_primary_not_a_second_color", () => {
    // "ONE accent" -- the same ultramarine drives the focus ring and the
    // sidebar accents rather than introducing an unrelated second brand hue.
    expect(rootBlock).toMatch(new RegExp(`--ring:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--sidebar-primary:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--sidebar-ring:\\s*${ACCENT_HEX}`));
  });

  it("test_theme_macros_stay_three_distinct_hues_so_they_can_be_told_apart", () => {
    const macros = ["--macro-protein", "--macro-fat", "--macro-carbs"].map(
      (name) => rootBlock.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))?.[1]
    );
    expect(macros.every(Boolean)).toBe(true);
    expect(new Set(macros).size).toBe(3);
  });

  it("test_theme_over_target_uses_the_warm_accent_never_destructive", () => {
    // Zero-shame rule: going OVER target is `--chart-5`, a warm ochre, and is
    // never allowed to resolve to the error colour.
    const chart5 = rootBlock.match(/--chart-5:\s*(#[0-9a-f]{6})/)?.[1];
    const destructive = rootBlock.match(/--destructive:\s*(#[0-9a-f]{6})/)?.[1];
    expect(chart5).toBeTruthy();
    expect(chart5).not.toBe(destructive);
  });
});

describe("Gravira theme: the second theme stays gone", () => {
  it("test_theme_globals_declares_no_dark_palette_or_dark_variant", () => {
    expect(css).not.toMatch(/@custom-variant\s+dark\b/);
    // A `.dark { … }` rule or a `.dark ` descendant selector would reintroduce
    // a second palette. (Prose mentioning the word "dark" is fine.)
    expect(css).not.toMatch(/^\s*\.dark[\s,{]/m);
  });

  it("test_theme_root_pins_the_light_color_scheme_for_the_user_agent", () => {
    // With no dark palette left, the UA must not paint scrollbars and form
    // chrome dark for a visitor whose system setting is dark.
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  it("test_theme_layout_renders_one_theme_and_reads_no_theme_cookie", () => {
    const layout = fs.readFileSync(LAYOUT_TSX_PATH, "utf-8");
    expect(layout).toMatch(/className={`light /);
    expect(layout).not.toMatch(/THEME_COOKIE|resolveTheme|fm_theme/);
    expect(layout).not.toMatch(/next-themes|ThemeProvider/);
  });

  it("test_theme_no_source_file_still_uses_the_tailwind_dark_variant", () => {
    const offenders = sourceFiles(SRC_DIR).filter((file) =>
      /(^|\s|")dark:[a-z[]/.test(fs.readFileSync(file, "utf-8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("Shell safety nets", () => {
  it("test_AS_125_base_layer_forces_overflow_x_hidden_on_html_and_body_as_a_global_safety_net", () => {
    // Belt-and-braces alongside the AppShell column's own overflow-x-hidden
    // + max-w-[430px]: even if a future page ships a child wider than the
    // viewport, the document itself cannot horizontally scroll.
    const baseLayer = css.match(/@layer base\s*{([\s\S]*?)\n}/)?.[1] ?? "";
    expect(baseLayer).toMatch(/overflow-x-hidden/);
  });
});

// ---------------------------------------------------------------------------
// Focus rings vs. the cascade.
//
// CSS layers are ordered, and an UNLAYERED rule outranks every layer — so a
// plain `box-shadow` written at the top level of globals.css beats everything
// Tailwind emits into its `utilities` layer, whatever the specificity. That is
// not a specificity race we could win by adding a class; the ring simply never
// gets to draw. It cost the app every keyboard focus ring on `.fm-lift` and on
// `.liquid-glass` buttons (the shared `Button` puts `focus-visible:ring-3` on
// all of its variants, and all of them are `.liquid-glass`).
//
// The fix is to hand the shadow to Tailwind's own `--tw-shadow` slot and keep
// the five-slot composition, so a ring utility paints into `--tw-ring-shadow`
// while the rule keeps both the cascade and its shadow. These tests guard that
// shape for the classes that sit under focusable elements.

/** Top-level rules of a stylesheet — the ones written outside any `@layer`,
 * which therefore outrank all of Tailwind's utilities. Selector must start at
 * column 0 and the block close with a `}` at column 0, which is how this file
 * is formatted throughout. */
function unlayeredRules(source: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const pattern = /^([^@{}\s][^{}]*?)\{([^{}]*)\n\}/gm;
  for (const match of source.matchAll(pattern)) {
    // A rule is usually preceded by its comment block; drop it so a failure
    // message names the selector rather than reciting a paragraph at us.
    const selector = match[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    rules.push({ selector, body: match[2]! });
  }
  return rules;
}

/** Rules that can swallow a focus ring: unlayered, setting `box-shadow` on the
 * element ITSELF (a `::before`/`::after` carries its own shadow and never
 * touches the host's), on a class that focusable components actually wear. */
function ringSwallowingRules(source: string) {
  return unlayeredRules(source).filter(
    (rule) =>
      /\.(fm-lift|liquid-glass)\b/.test(rule.selector) &&
      !/::(before|after)/.test(rule.selector) &&
      /(^|\s|;)box-shadow\s*:/.test(rule.body)
  );
}

describe("Focus rings survive the unlayered shadow rules", () => {
  it("test_focus_ring_unlayered_shadow_rules_compose_with_the_tailwind_ring_slot", () => {
    for (const rule of ringSwallowingRules(css)) {
      // Its shadow must go through Tailwind's slots, not be written flat.
      expect(
        rule.body,
        `"${rule.selector}" writes a bare box-shadow outside @layer, which ` +
          `outranks Tailwind's utilities layer and kills focus-visible:ring-*`
      ).toMatch(/var\(--tw-ring-shadow\)/);
      expect(rule.body).toMatch(/--tw-shadow\s*:/);
    }
  });

  it("test_focus_ring_the_two_classes_that_carry_shadows_are_actually_covered", () => {
    // Guards the guard: if these rules are ever renamed away, the test above
    // would pass vacuously over an empty list.
    const selectors = ringSwallowingRules(css).map((r) => r.selector);
    expect(selectors.some((s) => /\.fm-lift\b/.test(s))).toBe(true);
    expect(selectors.some((s) => /\.liquid-glass\b/.test(s))).toBe(true);
  });

  it("test_focus_ring_guard_rejects_a_bare_box_shadow_on_those_classes", () => {
    // And guards it the other way: prove the matcher CATCHES the shape this
    // whole block exists to prevent, rather than merely accepting the fixed
    // one. This is the exact code that shipped before the fix.
    const regressed = `.fm-lift {\n  box-shadow: var(--fm-lift);\n}\n`;
    const caught = ringSwallowingRules(regressed);
    expect(caught).toHaveLength(1);
    expect(caught[0]!.body).not.toMatch(/var\(--tw-ring-shadow\)/);
  });
});
