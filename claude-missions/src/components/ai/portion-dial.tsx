"use client";

import "./portion-dial.css";

import { Minus, Plus } from "lucide-react";

import {
  COUNT_MAX,
  COUNT_MIN,
  COVERAGE_MAX,
  COVERAGE_MIN,
  geometryHint,
  HEIGHT_LABELS,
  HEIGHT_LEVELS,
  LEVEL_MAX,
  LEVEL_MIN,
  portionGrams,
  type HeightLevel,
  type PortionGeometry,
  type PortionUnit,
} from "@/lib/ai/portion";

/**
 * "Koliko otprilike ima?" — the one thing the user knows and the camera never
 * will.
 *
 * Deliberately NOT a number field. Typed grams are worse than no answer: almost
 * nobody can name a portion in grams, so a keypad collects round guesses that
 * then drag the model's estimate with them. What people CAN judge is shape --
 * how much of the plate is covered, how full the bowl is, how many pancakes are
 * stacked -- so that is what we ask for, and the model's own mass-per-unit
 * turns it into grams while they watch.
 *
 * Which of the three dials appears is the model's call, made from the photo: a
 * soup has no "coverage" and a stack of pancakes has no meaningful "height", so
 * forcing all food through one control is what made the first version feel
 * wrong for half the meals.
 */

/** Dome drawn at full size; scaled from the plate's centre in both axes. */
const MOUND_PATH = "M 62 132 Q 160 18 258 132 Z";
const MOUND_HI_PATH = "M 104 132 Q 150 56 176 132 Z";

/** Bowl cross-section: rim to rim, curving through the bottom. */
const BOWL_PATH = "M 68 62 Q 74 152 160 152 Q 246 152 252 62";
const BOWL_TOP = 62;
const BOWL_BOTTOM = 152;

/** How tall the mound is drawn per height level. Not the nutrition factor --
 * that lives in `portion.ts`; this is only what reads well at a glance. */
const MOUND_HEIGHT_SCALE: Record<HeightLevel, number> = {
  tanko: 0.42,
  prst: 0.8,
  dva_prsta: 1.15,
};

/** Coverage is an AREA, so the drawn width goes with its square root. */
const spreadScale = (coverage: number) => Math.sqrt(coverage);

/** Tap targets under the coverage slider — how people actually describe a plate. */
const COVERAGE_ANCHORS: { value: number; label: string }[] = [
  { value: 0.25, label: "četvrt" },
  { value: 0.5, label: "pola" },
  { value: 0.75, label: "tri\nčetvrtine" },
  { value: 1, label: "ceo\ntanjir" },
];

const LEVEL_ANCHORS: { value: number; label: string }[] = [
  { value: 0.25, label: "na dnu" },
  { value: 0.5, label: "do pola" },
  { value: 0.75, label: "tri\nčetvrtine" },
  { value: 1, label: "do vrha" },
];

export function PortionDial({
  geometry,
  unit,
  onChange,
}: {
  geometry: PortionGeometry;
  unit: PortionUnit;
  onChange: (geometry: PortionGeometry) => void;
}) {
  const grams = portionGrams(geometry, unit);

  return (
    <div className="pd">
      <div className="pd-stage">
        {geometry.vessel === "ravan" ? (
          <PlateScene coverage={geometry.coverage} height={geometry.height} />
        ) : geometry.vessel === "dubok" ? (
          <BowlScene level={geometry.level} />
        ) : (
          <PiecesScene count={geometry.count} />
        )}

        <div className="pd-readout">
          <div className="pd-grams">
            {grams}
            <span>g</span>
          </div>
          <div className="pd-hint">{geometryHint(geometry, unit)}</div>
        </div>
      </div>

      {geometry.vessel === "ravan" ? (
        <>
          <Slider
            label="Koliki deo tanjira je pokriven"
            value={geometry.coverage}
            min={COVERAGE_MIN}
            max={COVERAGE_MAX}
            step={0.05}
            onChange={(coverage) => onChange({ ...geometry, coverage })}
          />
          <Anchors
            anchors={COVERAGE_ANCHORS}
            value={geometry.coverage}
            tolerance={0.09}
            onPick={(coverage) => onChange({ ...geometry, coverage })}
          />
          <div className="pd-heights">
            <span className="pd-heights-label">Koliko je visoko?</span>
            <div className="pd-chips">
              {HEIGHT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className="pd-chip"
                  data-on={geometry.height === level}
                  onClick={() => onChange({ ...geometry, height: level })}
                >
                  {HEIGHT_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {geometry.vessel === "dubok" ? (
        <>
          <Slider
            label="Dokle je napunjeno"
            value={geometry.level}
            min={LEVEL_MIN}
            max={LEVEL_MAX}
            step={0.05}
            onChange={(level) => onChange({ vessel: "dubok", level })}
          />
          <Anchors
            anchors={LEVEL_ANCHORS}
            value={geometry.level}
            tolerance={0.09}
            onPick={(level) => onChange({ vessel: "dubok", level })}
          />
        </>
      ) : null}

      {geometry.vessel === "komadi" ? (
        <div className="pd-stepper">
          <button
            type="button"
            aria-label="Manje komada"
            disabled={geometry.count <= COUNT_MIN}
            onClick={() =>
              onChange({ vessel: "komadi", count: geometry.count - 1 })
            }
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <span className="pd-stepper-value">
            {geometry.count}
            {/* "× palačinka" rather than "palačinke": the model writes the unit
                in the singular and Serbian plurals depend on the number, so the
                multiplication reading is the one that is always correct. */}
            <small>× {unit.naziv}</small>
          </span>
          <button
            type="button"
            aria-label="Više komada"
            disabled={geometry.count >= COUNT_MAX}
            onClick={() =>
              onChange({ vessel: "komadi", count: geometry.count + 1 })
            }
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* --- scenes -------------------------------------------------------------- */

/** Flat plate, three-quarter view: coverage widens the food, height raises it. */
function PlateScene({
  coverage,
  height,
}: {
  coverage: number;
  height: HeightLevel;
}) {
  const transform = `scale(${spreadScale(coverage)}, ${MOUND_HEIGHT_SCALE[height]})`;
  return (
    <svg
      className="pd-svg"
      viewBox="0 0 320 180"
      role="img"
      aria-label="Tanjir sa hranom"
    >
      <ellipse className="pd-plate-face" cx="160" cy="132" rx="104" ry="24" />
      {/* Back rim first: the food is drawn over it, so a mound hides the far
          edge of the plate the way a real one does. */}
      <path className="pd-plate-rim" d="M 56 132 A 104 24 0 0 1 264 132" />
      <clipPath id="pd-plate-clip">
        <rect x="0" y="0" width="320" height="132" />
      </clipPath>
      <g clipPath="url(#pd-plate-clip)">
        <path className="pd-mound" d={MOUND_PATH} style={{ transform }} />
        <path className="pd-mound-hi" d={MOUND_HI_PATH} style={{ transform }} />
      </g>
      <path className="pd-plate-rim" d="M 56 132 A 104 24 0 0 0 264 132" />
      <Fork />
    </svg>
  );
}

/** Deep bowl, cut through the middle: the only variable is the fill line. */
function BowlScene({ level }: { level: number }) {
  const drop = (1 - level) * (BOWL_BOTTOM - BOWL_TOP);
  return (
    <svg
      className="pd-svg"
      viewBox="0 0 320 180"
      role="img"
      aria-label="Duboka posuda sa hranom"
    >
      {/* Closing the wall path with a plain Z joins rim to rim, which is
          exactly the inside of the bowl. Adding corners below it instead makes
          a self-intersecting shape that fills everything EXCEPT the bowl. */}
      <clipPath id="pd-bowl-clip">
        <path d={`${BOWL_PATH} Z`} />
      </clipPath>
      <g clipPath="url(#pd-bowl-clip)">
        <g className="pd-fill" style={{ transform: `translateY(${drop}px)` }}>
          <rect x="60" y={BOWL_TOP} width="200" height="100" className="pd-fill-body" />
          <rect x="60" y={BOWL_TOP} width="200" height="5" className="pd-fill-top" />
        </g>
      </g>
      <path className="pd-bowl" d={BOWL_PATH} />
      <Fork />
    </svg>
  );
}

/** Countable food: the answer is a number of things, not a spread. */
function PiecesScene({ count }: { count: number }) {
  const shown = Math.min(count, 8);
  const perRow = 4;
  // Keep the pieces centred in the stage whether they need one row or two,
  // instead of letting a single row sit high with dead space under it.
  const rows = Math.ceil(shown / perRow);
  const baseY = 112 - (rows - 1) * 23;
  return (
    <svg
      className="pd-svg"
      viewBox="0 0 320 180"
      role="img"
      aria-label={`${count} komada`}
    >
      {Array.from({ length: shown }, (_, i) => {
        const row = Math.floor(i / perRow);
        const inRow = i % perRow;
        const rowCount = Math.min(shown - row * perRow, perRow);
        const spacing = 62;
        const x = 160 + (inRow - (rowCount - 1) / 2) * spacing;
        const y = baseY + row * 46;
        return (
          <g key={i} className="pd-piece" style={{ animationDelay: `${i * 45}ms` }}>
            <ellipse cx={x} cy={y + 5} rx="26" ry="9" className="pd-piece-shadow" />
            <ellipse cx={x} cy={y} rx="26" ry="11" className="pd-piece-body" />
          </g>
        );
      })}
      {count > shown ? (
        <text x="160" y="168" className="pd-piece-more">
          +{count - shown}
        </text>
      ) : null}
    </svg>
  );
}

/** Fixed-size fork: the same ~19-20 cm anchor the capture guide teaches, so the
 * food is always read against something real. */
function Fork() {
  return (
    <g className="pd-fork">
      <path d="M 292 108 L 292 152" />
      <path d="M 285 108 L 285 124 Q 285 130 292 130" />
      <path d="M 299 108 L 299 124 Q 299 130 292 130" />
    </g>
  );
}

/* --- controls ------------------------------------------------------------ */

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      className="pd-range"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ ["--pd-fill" as string]: `${fill}%` }}
    />
  );
}

function Anchors({
  anchors,
  value,
  tolerance,
  onPick,
}: {
  anchors: { value: number; label: string }[];
  value: number;
  tolerance: number;
  onPick: (value: number) => void;
}) {
  return (
    <div className="pd-anchors">
      {anchors.map((anchor) => (
        <button
          key={anchor.value}
          type="button"
          className="pd-anchor"
          data-on={Math.abs(value - anchor.value) <= tolerance}
          onClick={() => onPick(anchor.value)}
        >
          {anchor.label.split("\n").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </button>
      ))}
    </div>
  );
}
