"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface IconOptionItem<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Rendered inside a round badge on the left. Keep it `aria-hidden` -- the
   *  option's accessible name comes from `label` (+ `description`). */
  icon: ReactNode;
}

/** `comfortable` (default) is roomy for short lists (pol); `compact` tightens
 *  padding + badge so longer lists (aktivnost, cilj) fit one screen unscrolled. */
type IconOptionSize = "comfortable" | "compact";

const SIZE_STYLES: Record<
  IconOptionSize,
  { list: string; button: string; badge: string }
> = {
  comfortable: { list: "gap-3", button: "px-4 py-4", badge: "size-10" },
  compact: { list: "gap-2", button: "px-4 py-3", badge: "size-9" },
};

/**
 * F015: single-select "radio group made of big icon cards" -- a round icon
 * badge, a title (+ optional description), and a radio dot on the right; the
 * picked card gets a bold `--foreground` border (shared by the pol and
 * aktivnost steps). `role="radiogroup"`/`role="radio"` + `aria-checked` gives
 * correct assistive-tech semantics, and every option is a real `<button>` so
 * it's keyboard-reachable (Tab between options, Enter/Space to pick) without
 * any extra key-handling code (AS-128).
 */
export function IconOptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  size = "comfortable",
}: {
  legend: string;
  options: IconOptionItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  size?: IconOptionSize;
}) {
  const styles = SIZE_STYLES[size];
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className={cn("flex flex-col", styles.list)}
    >
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
              "flex w-full items-center gap-4 rounded-2xl border-2 text-left transition-colors",
              styles.button,
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-foreground bg-card"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full transition-colors",
                styles.badge,
                // Selected badge flips to a solid foreground fill so the pick
                // reads at a glance (Cal-AI-style highlight).
                selected
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              {option.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold text-foreground">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-sm text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
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
                <span className="onb-pop size-1.5 rounded-full bg-background" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
