"use client";

import "./portion-dial.css";

import { PORTION_MAX_G, PORTION_MIN_G, portionHint } from "@/lib/ai/portion";

/**
 * "Koliko otprilike ima?" — the one thing the user knows and the camera never
 * will.
 *
 * Deliberately NOT a number field. Typed grams are worse than no answer: almost
 * nobody can name a portion in grams, so a keypad collects round guesses that
 * then drag the model's estimate with them. Dragging a plate instead means the
 * user matches a PICTURE to what is in front of them, and reads the grams off
 * the picture rather than inventing them.
 *
 * The mound scales by cbrt(g / max): volume grows with the cube of a linear
 * dimension, so uniform scaling by the cube root makes it grow the way food
 * actually piles up. The fork stays at fixed size beside it -- the same ~19-20
 * cm anchor the capture guide teaches -- so the mound is always read against
 * something real.
 *
 * Presentational and hook-free; the flow owns the value.
 */

/** Tap targets under the slider — the sizes people actually think in. */
const ANCHORS: { g: number; label: string }[] = [
  { g: 120, label: "malo" },
  { g: 250, label: "pola\ntanjira" },
  { g: 380, label: "pun\ntanjir" },
  { g: 550, label: "pun i\nnavrh" },
  { g: 750, label: "duplo" },
];

/** Dome drawn at full size; scaled down from the plate's centre. */
const MOUND_PATH = "M 62 132 Q 160 18 258 132 Z";
const MOUND_HI_PATH = "M 104 132 Q 150 56 176 132 Z";

/** How big to draw the mound for a given mass (see the cube-root note above). */
function moundScale(grams: number): number {
  const clamped = Math.min(Math.max(grams, PORTION_MIN_G), PORTION_MAX_G);
  return Math.cbrt(clamped / PORTION_MAX_G);
}

export function PortionDial({
  grams,
  onChange,
}: {
  grams: number;
  onChange: (grams: number) => void;
}) {
  const scale = moundScale(grams);
  const fill =
    ((grams - PORTION_MIN_G) / (PORTION_MAX_G - PORTION_MIN_G)) * 100;

  return (
    <div className="pd">
      <div className="pd-stage">
        <svg
          className="pd-svg"
          viewBox="0 0 320 180"
          role="img"
          aria-label={`Porcija otprilike ${grams} grama`}
        >
          {/* Plate, seen slightly from the side so height reads as height. */}
          <ellipse className="pd-plate-face" cx="160" cy="132" rx="104" ry="24" />
          {/* Back rim first: the food is then drawn over it, so a mound hides
              the far edge of the plate the way a real one does. The near rim
              goes on afterwards, in front of the food. */}
          <path
            className="pd-plate-rim"
            d="M 56 132 A 104 24 0 0 1 264 132"
          />

          {/* The food itself. Clipped to the plate so it never floats. */}
          <clipPath id="pd-clip">
            <rect x="0" y="0" width="320" height="132" />
          </clipPath>
          <g clipPath="url(#pd-clip)">
            <path
              className="pd-mound"
              d={MOUND_PATH}
              style={{ transform: `scale(${scale})` }}
            />
            <path
              className="pd-mound-hi"
              d={MOUND_HI_PATH}
              style={{ transform: `scale(${scale})` }}
            />
          </g>

          <path className="pd-plate-rim" d="M 56 132 A 104 24 0 0 0 264 132" />

          {/* Fork: fixed size, the scale anchor. */}
          <g className="pd-fork">
            <path d="M 292 108 L 292 152" />
            <path d="M 285 108 L 285 124 Q 285 130 292 130" />
            <path d="M 299 108 L 299 124 Q 299 130 292 130" />
          </g>
        </svg>

        <div className="pd-readout">
          <div className="pd-grams">
            {grams}
            <span>g</span>
          </div>
          <div className="pd-hint">{portionHint(grams)}</div>
        </div>
      </div>

      <input
        className="pd-range"
        type="range"
        min={PORTION_MIN_G}
        max={PORTION_MAX_G}
        step={10}
        value={grams}
        aria-label="Koliko otprilike ima hrane, u gramima"
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ["--pd-fill" as string]: `${fill}%` }}
      />

      <div className="pd-anchors">
        {ANCHORS.map((anchor) => (
          <button
            key={anchor.g}
            type="button"
            className="pd-anchor"
            data-on={Math.abs(grams - anchor.g) <= 40}
            onClick={() => onChange(anchor.g)}
          >
            {anchor.label.split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
