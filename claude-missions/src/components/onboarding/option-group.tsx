"use client";

import { cn } from "@/lib/utils";

export interface OptionGroupItem<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/**
 * F015: single-select "radio group made of big tappable buttons" used by
 * the pol and aktivnost steps. `role="radiogroup"`/`role="radio"` +
 * `aria-checked` gives it correct semantics for assistive tech, and every
 * option is a real `<button>` so it's keyboard-reachable (Tab between
 * options, Enter/Space to pick) without any extra key-handling code
 * (AS-128 / clarified accessibility answer).
 */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: OptionGroupItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex flex-col gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            <span className="text-base font-semibold">{option.label}</span>
            {option.description ? (
              <span className="text-sm text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
