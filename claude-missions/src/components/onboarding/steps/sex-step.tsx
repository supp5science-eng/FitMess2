"use client";

import type { Sex } from "@/lib/types/db";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/onboarding/field-error";

/** Hand-rolled Mars (♂) / Venus (♀) glyphs -- no icon-lib dependency, matching
 *  this codebase's "charts are hand-rolled SVG" convention. `aria-hidden` so the
 *  option's accessible name stays the label text alone. */
function SexIcon({ sex }: { sex: Sex }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-5",
    "aria-hidden": true,
  };
  return sex === "male" ? (
    <svg {...common}>
      <circle cx="10" cy="14" r="6" />
      <path d="M14.5 9.5 21 3" />
      <path d="M17 3h4v4" />
    </svg>
  ) : (
    <svg {...common}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 19h6" />
    </svg>
  );
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "Muško" },
  { value: "female", label: "Žensko" },
];

/** F015 step 1 (pol) -- AS-019: collects sex. Icon-card single-select: a
 *  gender glyph, the label, and a radio dot on the right; the picked card gets a
 *  bold `--foreground` border. Real `<button role="radio">`s keep it keyboard-
 *  reachable and correctly announced for assistive tech (AS-128). */
export function SexStep({
  value,
  onChange,
  error,
}: {
  value: Sex | null;
  onChange: (value: Sex) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koji je tvoj pol?
        </h2>
        <p className="text-sm text-muted-foreground">
          Ovo nam pomaže da tačnije izračunamo tvoje potrebe za kalorijama.
        </p>
      </div>

      <div role="radiogroup" aria-label="Pol" className="flex flex-col gap-3">
        {SEX_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-foreground bg-card"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <SexIcon sex={option.value} />
              </span>
              <span className="flex-1 text-base font-semibold text-foreground">
                {option.label}
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected
                    ? "border-foreground bg-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {selected ? (
                  <span className="size-1.5 rounded-full bg-background" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <FieldError message={error} />
    </div>
  );
}
