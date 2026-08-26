import localFont from "next/font/local";

/**
 * Prizma's own voice, in type.
 *
 * Everything the AGENT says on the /ai screen — the greeting, the live
 * context line, her replies, the "razmišljam" placeholder — is set in
 * Anthropic Sans. Everything the APP says around her (chips, action cards,
 * the input row) and everything the USER said (the quoted line) stays on
 * Inter. That split is the point: the face changes exactly when the speaker
 * does, so Prizma reads as someone talking rather than as more UI copy.
 *
 * ONE variable file, not seven. The upstream package ships `@300` … `@900`
 * as seven byte-identical copies of the same variable font; the `wght`
 * axis (300–800) covers every weight the screen asks for, so we carry a
 * single 98 KB woff2 — subset to latin + latin-ext + punctuation, which is
 * everything Serbian prose can hit. The `opsz` axis (16–48) is left to
 * `font-optical-sizing: auto`: her replies render at 22px and the greeting
 * at 24px, and the face should tighten between them on its own.
 *
 * NOT registered in `layout.tsx`, deliberately. The three faces there load
 * on every cold launch of every screen, and that file's comments are emphatic
 * about the cost. Loading it from this module instead means the browser only
 * ever fetches it on the one screen Prizma lives on.
 *
 * PROVENANCE: "Anthropic Sans Web Text", © 2025 Anthropic PBC, drawn by
 * BSPK LLC (bspk.xyz) for Anthropic — a commissioned corporate typeface. It
 * carries no embedded licence string and Anthropic has not published open
 * terms for it; the npm package it came from is a third party's
 * redistribution whose MIT licence covers that packaging, not the face.
 * Treat shipping it as an open question, not as settled.
 */
export const prizmaFont = localFont({
  src: "./fonts/AnthropicSans-var.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  variable: "--font-prizma",
  // Inter is the app's own face and is already loaded — swapping through it
  // costs no extra request and keeps the reflow small when the swap lands.
  fallback: ["Inter", "system-ui", "sans-serif"],
});
