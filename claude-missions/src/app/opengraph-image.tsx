import { ImageResponse } from "next/og";

import { wordmarkLetterColors } from "@/lib/brand/wordmark";

/**
 * The social-share card (`og:image` / `twitter:image`) for the site root,
 * generated at the standard 1200×630 ratio via Next's file-based metadata
 * convention — placing this file here auto-wires the Open Graph and Twitter
 * image tags site-wide, so link previews on Facebook, X, WhatsApp, Viber,
 * Slack, etc. render a branded card instead of a bare URL.
 *
 * Rendered with `next/og` (no extra dependency) using system-styled markup
 * only — no remote font fetch — so the build stays hermetic and fast. The
 * palette is the app's "Gravira" plate: the pale warm paper (`--paper`,
 * `#fdf9f0`) carrying the ultramarine ink (`--ink`, `#1c1b8f`), with the
 * halftone screen printed across it as a repeating dot grid — `next/og` has
 * no CSS mask, so the stipple is laid on flat and kept faint enough to sit
 * behind the type.
 */
export const runtime = "edge";

export const alt =
  "FitMess — praćenje kalorija bez griže savesti. Nedelja je jedinica uspeha.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MESS_LETTERS = ["M", "e", "s", "s"];
const MESS_COLORS = wordmarkLetterColors(MESS_LETTERS.length, "paper");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(28,27,143,0.12) 1px, transparent 1.6px), radial-gradient(120% 120% at 100% 0%, rgba(47,44,230,0.12) 0%, transparent 58%)",
          backgroundSize: "10px 10px, 100% 100%",
          padding: "72px 80px",
          color: "#1c1b8f",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2f2ce6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            F
          </div>
          {/* "Mess" in the pear's shell gradient, one letter at a time --
              `next/og` renders flat fills, so the shimmer is sampled per
              letter (same trick as the PDF report). Paper stops: this card
              is printed on the paper ground. */}
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            <span>Fit</span>
            {MESS_LETTERS.map((letter, index) => (
              <span key={`${letter}-${index}`} style={{ color: MESS_COLORS[index] }}>
                {letter}
              </span>
            ))}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Prati kalorije bez muke
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.3,
              color: "#5654b4",
              maxWidth: 820,
            }}
          >
            Nedelja je jedinica uspeha — jedan loš obrok te ne ruši.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 600,
            color: "#2f2ce6",
          }}
        >
          fitmess.app
        </div>
      </div>
    ),
    { ...size },
  );
}
