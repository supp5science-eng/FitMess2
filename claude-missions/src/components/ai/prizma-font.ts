import { Geist } from "next/font/google";
import localFont from "next/font/local";

/**
 * Prizma's two voices, in type.
 *
 * The AI screen has two jobs and one face was doing both badly. So:
 *
 *   `prizmaVoice`  — Anthropic Sans. Her NAMEPLATE: the greeting and the one
 *                    line of live context. Short, personal, said once.
 *   `prizmaProse`  — Geist. Her ANSWERS, and the "razmišljam" placeholder
 *                    standing in for one. Paragraphs, read rather than
 *                    glanced at.
 *
 * Two groteskes rather than a grotesk and a serif: the split has to be
 * audible without turning her answers into a magazine column. Geist is the
 * open face closest to what the current crop of assistants read like, and it
 * is quieter than Anthropic Sans at paragraph length — which is the whole
 * point, since the nameplate should be the thing with a voice and the answer
 * the thing with the information.
 *
 * Everything the APP says around her (chips, action cards, the input row)
 * and everything the USER said stays on Inter. The face changes exactly when
 * the speaker does.
 *
 * NEITHER is registered in `layout.tsx`, deliberately. The three faces there
 * load on every cold launch of every screen and that file's comments are
 * emphatic about the cost. Declared here, the browser only fetches them on
 * the one screen Prizma lives on.
 */

/**
 * ONE variable file, not seven. The upstream package ships `@300` … `@900`
 * as seven byte-identical copies of the same variable font; the `wght` axis
 * (300–800) covers every weight the screen asks for, so we carry a single
 * 98 KB woff2 — subset to latin + latin-ext + punctuation, which is
 * everything Serbian prose can hit.
 *
 * PROVENANCE: "Anthropic Sans Web Text", © 2025 Anthropic PBC, drawn by
 * BSPK LLC (bspk.xyz) for Anthropic — a commissioned corporate typeface. It
 * carries no embedded licence string and Anthropic has not published open
 * terms for it; the npm package it came from is a third party's
 * redistribution whose MIT licence covers that packaging, not the face. The
 * repository owner was shown this and chose to include it.
 */
export const prizmaVoice = localFont({
  src: "./fonts/AnthropicSans-var.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  variable: "--font-prizma-voice",
  // Inter is the app's own face and is already loaded — swapping through it
  // costs no extra request and keeps the reflow small when the swap lands.
  fallback: ["Inter", "system-ui", "sans-serif"],
});

/**
 * `latin-ext` is NOT optional here: her answers are Serbian prose and every
 * other sentence carries a č, ć, ž, š or đ. Google serves the two subsets as
 * separate files behind `unicode-range`, so the extended cut only costs a
 * request on the screen that renders those letters — which is this one.
 */
export const prizmaProse = Geist({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-prizma-prose",
  fallback: ["Inter", "system-ui", "sans-serif"],
});
