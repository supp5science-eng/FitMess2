/* eslint-disable @next/next/no-img-element */
import type { ReactElement } from "react";

import { wordmarkLetterColors } from "@/lib/brand/wordmark";
import type { ScanCardModel } from "@/lib/share/card";
import { CARD_FORMATS } from "@/lib/share/card";
import { PEAR_MARK_DATA_URI } from "@/lib/share/pear-mark";
import { tierStyle } from "@/lib/share/tier";

/**
 * The "Scan moment" share card (Share-cards PRD §3.1), as a satori JSX tree for
 * `next/og`. Design brief, straight from the PRD:
 *
 *   - The user's meal photo is the star, full-bleed (§3.1). FitMess is a small,
 *     discreet signature, never a billboard (§2.1 "flex korisnika, ne ad").
 *   - One recognizable skeleton, one palette, one typeface -> the "Spotify
 *     Wrapped" half-second recognition (§2.2).
 *   - A light, premium, minimal register: a soft scrim only for legibility, at
 *     most four numbers (kcal + P/UH/M), no CTA, no QR, no watermark (§8).
 *   - The tier (Standard→Onyx) is the only thing that visibly grows with the
 *     streak: an accent on the frame + kcal, and Onyx's darker edition (§4).
 *
 * Pure: a function of `ScanCardModel` (assembled and validated in `route.tsx`).
 * Everything is inline-styled because satori supports no external CSS and no CSS
 * variables -- concrete hex only.
 */
export function scanCardElement(model: ScanCardModel): ReactElement {
  const { width, height } = CARD_FORMATS[model.format];
  const tier = tierStyle(model.tier);
  const isStory = model.format === "story";

  // Horizontal metrics are constant (both formats are 1080 wide); only the
  // vertical rhythm and a couple of hero sizes flex between story and post.
  const pad = 84;
  const nameSize = isStory ? 76 : 66;
  const kcalSize = isStory ? 150 : 128;
  const bottomInset = isStory ? 128 : 92;
  const scrimHeight = isStory ? "62%" : "72%";
  const frameInset = 26;
  const markSize = isStory ? 58 : 52;

  const messColors = wordmarkLetterColors(4, "dark");
  const textShadow = "0 2px 24px rgba(0,0,0,0.55)";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height,
        backgroundColor: "#0a0c0b",
        fontFamily: '"Inter", sans-serif',
        overflow: "hidden",
      }}
    >
      {/* Layer 1 — the meal photo, full-bleed (§3.1 "fotka preko celog kadra") */}
      <img
        src={model.photoDataUri}
        alt=""
        width={width}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          objectFit: "cover",
        }}
      />

      {/* Layer 2 — tier darkening (Onyx is "the dark edition"; others ~none) */}
      {tier.photoOverlay !== "rgba(0,0,0,0)" ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: tier.photoOverlay,
          }}
        />
      ) : null}

      {/* Layer 3 — bottom scrim, ONLY for text legibility over the photo (§3.1) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width,
          height: scrimHeight,
          backgroundImage:
            "linear-gradient(to top, rgba(6,8,7,0.92) 0%, rgba(6,8,7,0.78) 26%, rgba(6,8,7,0.34) 62%, rgba(6,8,7,0) 100%)",
        }}
      />

      {/* Layer 4 — the tier frame: the most glanceable earned signal (§4) */}
      <div
        style={{
          position: "absolute",
          top: frameInset,
          left: frameInset,
          width: width - frameInset * 2,
          height: height - frameInset * 2,
          border: `${model.tier === "standard" ? 2 : 3}px solid ${tier.frame}`,
          borderRadius: 44,
        }}
      />

      {/* Layer 5 — the content, anchored to the bottom of the card */}
      <div
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          bottom: bottomInset,
          width: width - pad * 2,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Dish name — the hero line */}
        <div
          style={{
            display: "flex",
            fontSize: nameSize,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#ffffff",
            textShadow,
          }}
        >
          {model.dishName}
        </div>

        {/* kcal — the big earned number, in the tier accent */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            marginTop: isStory ? 34 : 26,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: kcalSize,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: -5,
              color: tier.accent,
              textShadow,
            }}
          >
            {model.kcal}
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 18,
              marginBottom: isStory ? 20 : 16,
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: -1,
              color: "rgba(255,255,255,0.72)",
              textShadow,
            }}
          >
            kcal
          </div>
        </div>

        {/* Macros — the fixed P/UH/M signature row, each with its accent dot */}
        <div
          style={{
            display: "flex",
            marginTop: isStory ? 44 : 32,
          }}
        >
          {model.macros.map((macro) => (
            <div
              key={macro.label}
              style={{
                display: "flex",
                flexDirection: "column",
                marginRight: 64,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: macro.color,
                    marginRight: 14,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    fontSize: 46,
                    fontWeight: 700,
                    letterSpacing: -1,
                    color: "#ffffff",
                    textShadow,
                  }}
                >
                  {macro.grams}
                  <div
                    style={{
                      display: "flex",
                      marginLeft: 5,
                      marginBottom: 4,
                      fontSize: 26,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    g
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 23,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: "rgba(255,255,255,0.58)",
                }}
              >
                {macro.label}
              </div>
            </div>
          ))}
        </div>

        {/* Signature — the pear mark + the FitMess wordmark, and nothing else.
            No domain, no URL, no CTA: on someone's story this has to read as
            their flex with a maker's mark on it, not as an ad (§2.1/§8). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: isStory ? 56 : 40,
          }}
        >
          <img
            src={PEAR_MARK_DATA_URI}
            alt=""
            width={markSize}
            height={markSize}
            style={{ width: markSize, height: markSize, marginRight: 18 }}
          />

          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            <div style={{ display: "flex", color: "#ffffff" }}>Fit</div>
            {/* "Mess" carries the pear's iridescent shell. satori paints flat
                fills only, so the shimmer is sampled one letter at a time — the
                same trick the PDF report and the OG card use. */}
            {["M", "e", "s", "s"].map((letter, index) => (
              <div
                key={`${letter}-${index}`}
                style={{ display: "flex", color: messColors[index] }}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Onyx alone earns a badge (§4) */}
          {tier.badge ? (
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 999,
                border: `1px solid ${tier.frame}`,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                color: tier.accent,
              }}
            >
              {tier.badge}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
