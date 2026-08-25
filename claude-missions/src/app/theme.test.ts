import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The "Žar" theme (2026-08-25) — ONE dark ember palette, with the retired
// "Gravira" plate kept verbatim under `.light` for the pinned subtrees.
//
// The total redesign swapped the app's single palette from blue-ink-on-paper
// to a dark, romantic ember room: near-black maroon ground, warm rose-cream
// ink, one vivid ember red as THE accent. These tests guard the things that
// are easy to undo by accident:
//
//   1. the palette really is that duotone-plus-ember, and the accent is ONE
//      hue reused at every accent touchpoint rather than a second brand
//      colour creeping in;
//   2. no parallel theme system returns — no `.dark` block, no `dark:`
//      variant, no theme class or cookie read in the root layout. `.light`
//      is NOT a theme switch: it is the frozen legacy palette pinned by
//      `/upitnik` and the marketing landing;
//   3. the zero-shame rule survives the retheme: over-target is gold, never
//      the error colour.
//
// It can't render computed CSS in jsdom (no stylesheet cascade), so it reads
// the source of truth directly.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS_PATH = path.resolve(HERE, "globals.css");
const LAYOUT_TSX_PATH = path.resolve(HERE, "layout.tsx");
const SRC_DIR = path.resolve(HERE, "..");

const PAPER_HEX = "#1d0806";
const INK_HEX = "#ffe9dd";
const ACCENT_HEX = "#ff5a3c";

// The retired Gravira plate, frozen under `.light`.
const LEGACY_PAPER_HEX = "#fdf9f0";
const LEGACY_INK_HEX = "#1c1b8f";

const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
const rootBlock = css.match(/^:root\s*{([\s\S]*?)\n}/m)?.[1] ?? "";
const legacyBlock = css.match(/^\.light\s*{([\s\S]*?)\n}/m)?.[1] ?? "";

/** Every `.ts`/`.tsx`/`.css` file under `src`, for the repo-wide sweeps. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("Žar theme: dark ember room, one hot accent", () => {
  it("test_theme_root_defines_the_two_printing_inks", () => {
    expect(rootBlock).toMatch(new RegExp(`--paper:\\s*${PAPER_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--ink:\\s*${INK_HEX}`));
    // The semantic surface/type tokens resolve to those same two inks, so a
    // component reaching for `bg-background`/`text-foreground` lands on the
    // dark ground and the warm ink rather than on some third colour.
    expect(rootBlock).toMatch(new RegExp(`--background:\\s*${PAPER_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--foreground:\\s*${INK_HEX}`));
  });

  it("test_theme_primary_is_the_bright_ultramarine_on_paper", () => {
    // (Historic test name kept for the validation contract; the assertion is
    // now: primary is the ember red, with dark type on it so it reads as
    // light, not paint.)
    expect(rootBlock).toMatch(new RegExp(`--primary:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(/--primary-foreground:\s*#2a0a04/);
  });

  it("test_theme_same_accent_hue_is_reused_for_ring_and_sidebar_primary_not_a_second_color", () => {
    // "ONE accent" -- the same ember drives the focus ring and the sidebar
    // accents rather than introducing an unrelated second brand hue.
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
    // Zero-shame rule: going OVER target is `--chart-5`, a warm gold, and is
    // never allowed to resolve to the error colour.
    const chart5 = rootBlock.match(/--chart-5:\s*(#[0-9a-f]{6})/)?.[1];
    const destructive = rootBlock.match(/--destructive:\s*(#[0-9a-f]{6})/)?.[1];
    expect(chart5).toBeTruthy();
    expect(chart5).not.toBe(destructive);
  });

  it("test_theme_destructive_is_not_the_primary_ember", () => {
    // In an all-red room, danger must be a visibly different temperature
    // than the primary action, or every button reads as a warning.
    const destructive = rootBlock.match(/--destructive:\s*(#[0-9a-f]{6})/)?.[1];
    expect(destructive).toBeTruthy();
    expect(destructive).not.toBe(ACCENT_HEX);
  });
});

describe("Žar theme: no parallel theme system", () => {
  it("test_theme_globals_declares_no_dark_palette_or_dark_variant", () => {
    expect(css).not.toMatch(/@custom-variant\s+dark\b/);
    // A `.dark { … }` rule or a `.dark ` descendant selector would reintroduce
    // a second palette system. (Prose mentioning the word "dark" is fine.)
    expect(css).not.toMatch(/^\s*\.dark[\s,{]/m);
  });

  it("test_theme_root_pins_the_dark_color_scheme_for_the_user_agent", () => {
    // The one theme is dark: the UA must paint scrollbars and form chrome in
    // the ember room, not in a light default. The `.light`-pinned subtrees
    // re-pin `color-scheme: light` themselves.
    expect(css).toMatch(/color-scheme:\s*dark/);
    expect(legacyBlock).toMatch(/color-scheme:\s*light/);
  });

  it("test_theme_legacy_gravira_palette_stays_frozen_under_light_for_the_pinned_subtrees", () => {
    // `/upitnik` and the marketing landing pin `.light` and must keep
    // rendering the retired blue-ink-on-warm-paper plate, byte for byte.
    expect(legacyBlock).toMatch(new RegExp(`--paper:\\s*${LEGACY_PAPER_HEX}`));
    expect(legacyBlock).toMatch(new RegExp(`--ink:\\s*${LEGACY_INK_HEX}`));
    expect(legacyBlock).toMatch(/--primary:\s*#2f2ce6/);
  });

  it("test_theme_layout_renders_one_theme_and_reads_no_theme_cookie", () => {
    const layout = fs.readFileSync(LAYOUT_TSX_PATH, "utf-8");
    // <html> no longer carries the `light` class: that class is the frozen
    // legacy palette, pinned only by the excluded subtrees.
    expect(layout).not.toMatch(/className={`light /);
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
