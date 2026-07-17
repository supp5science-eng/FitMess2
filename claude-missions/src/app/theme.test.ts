import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// F005: theme tokens (AS-127 — light theme with one consistent accent).
//
// This file can't render actual computed CSS in jsdom (no stylesheet
// cascade), so it verifies the source of truth directly: `globals.css`
// defines exactly one energetic-green accent hue and reuses it across every
// accent touchpoint, the `:root` (light) background stays near-white, and
// the shell never opts into the inert `.dark` scaffold. Real visual proof
// of the rendered accent lives in the 375px/desktop screenshots captured
// for this feature's evidence artifact.

const GLOBALS_CSS_PATH = path.resolve(
  __dirname,
  "globals.css"
);
const LAYOUT_TSX_PATH = path.resolve(__dirname, "layout.tsx");

const ACCENT_HEX = "#16a34a";

describe("F005: light theme, single green accent (AS-127)", () => {
  const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
  const rootBlockMatch = css.match(/:root\s*{([\s\S]*?)\n}/);
  const rootBlock = rootBlockMatch?.[1] ?? "";

  it("test_AS_127_root_theme_defines_the_energetic_green_accent_as_primary", () => {
    expect(rootBlock).toMatch(new RegExp(`--primary:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(/--primary-foreground:\s*#ffffff/);
  });

  it("test_AS_127_same_accent_hue_is_reused_for_ring_and_sidebar_primary_not_a_second_color", () => {
    // "ONE energetic-green accent" -- the same base hue drives the focus
    // ring and sidebar-primary token, rather than introducing an unrelated
    // second brand color.
    expect(rootBlock).toMatch(new RegExp(`--ring:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--sidebar-primary:\\s*${ACCENT_HEX}`));
    expect(rootBlock).toMatch(new RegExp(`--sidebar-ring:\\s*${ACCENT_HEX}`));
  });

  it("test_AS_127_root_background_is_near_white_confirming_light_theme", () => {
    expect(rootBlock).toMatch(/--background:\s*oklch\(1 0 0\)/);
  });

  it("test_AS_127_layout_never_applies_the_dark_class_leaving_dark_mode_scaffold_inert", () => {
    const layout = fs.readFileSync(LAYOUT_TSX_PATH, "utf-8");
    expect(layout).not.toMatch(/\bdark\b/);
    expect(layout).not.toMatch(/next-themes|ThemeProvider/);
  });

  it("test_AS_125_base_layer_forces_overflow_x_hidden_on_html_and_body_as_a_global_safety_net", () => {
    // Belt-and-braces alongside the AppShell column's own overflow-x-hidden
    // + max-w-[430px]: even if a future page ships a child wider than the
    // viewport, the document itself cannot horizontally scroll.
    const baseLayerMatch = css.match(/@layer base\s*{([\s\S]*?)\n}\n?$/);
    const baseLayer = baseLayerMatch?.[1] ?? "";
    expect(baseLayer).toMatch(/overflow-x-hidden/);
  });
});
