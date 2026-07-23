import { ImageResponse } from "next/og";

/**
 * The social-share card (`og:image` / `twitter:image`) for the site root,
 * generated at the standard 1200×630 ratio via Next's file-based metadata
 * convention — placing this file here auto-wires the Open Graph and Twitter
 * image tags site-wide, so link previews on Facebook, X, WhatsApp, Viber,
 * Slack, etc. render a branded card instead of a bare URL.
 *
 * Rendered with `next/og` (no extra dependency) using system-styled markup
 * only — no remote font fetch — so the build stays hermetic and fast. The
 * palette mirrors the app's dark surface (`#0a0c0b`) and the calorie-ring
 * green accent.
 */
export const runtime = "edge";

export const alt =
  "FitMess — praćenje kalorija bez griže savesti. Nedelja je jedinica uspeha.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background:
            "radial-gradient(120% 120% at 100% 0%, #12241a 0%, #0a0c0b 55%)",
          padding: "72px 80px",
          color: "#f5f7f5",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#54d17a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: "#0a0c0b",
            }}
          >
            F
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            FitMess
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
              color: "#a7b3ab",
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
            color: "#54d17a",
          }}
        >
          fitmess.app
        </div>
      </div>
    ),
    { ...size },
  );
}
