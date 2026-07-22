"use client";

import { useEffect, useRef, useState } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ITEM_H = 44; // px per row
const VISIBLE_ROWS = 5; // odd, so one row is dead-center
const PAD = ((VISIBLE_ROWS - 1) / 2) * ITEM_H; // spacer so ends can center

/**
 * F015: an inline iOS-style scroll wheel (Cal-AI look) for the numeric
 * onboarding steps. A single scroll-snap column with a centered highlight pill
 * and faded neighbours.
 *
 * Accessibility + test hook: the source of truth is a visually-hidden native
 * `<select>` (labeled, keyboard-reachable, and what `getByLabelText` drives) —
 * the visual wheel is `aria-hidden` and just mirrors/commits the same value.
 * The store stays metric; `renderOption` only changes the display.
 */
export function WheelPicker({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Izaberi",
  error,
  renderOption,
  autoFocus,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: number[];
  placeholder?: string;
  error?: string;
  renderOption?: (value: number) => string;
  autoFocus?: boolean;
}) {
  const errorId = `${id}-error`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = value === null ? -1 : options.indexOf(value);
  // Live-updated centered row (drives the fade) — starts at the current value.
  const [centerIndex, setCenterIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : Math.floor(options.length / 2)
  );

  const format = (v: number) => (renderOption ? renderOption(v) : String(v));

  // Keep the wheel scrolled to the controlled value (initial mount + external
  // changes like Back navigation). No-ops when it's already centered there, so
  // our own scroll-driven commits don't cause a feedback loop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIndex < 0) return;
    const current = Math.round(el.scrollTop / ITEM_H);
    if (current !== selectedIndex) {
      el.scrollTop = selectedIndex * ITEM_H;
    }
    setCenterIndex(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / ITEM_H))
    );
    if (idx !== centerIndex) setCenterIndex(idx);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      if (options[idx] !== value) onChange(options[idx]);
    }, 120);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>

      {/* Source of truth: accessible + test-driven, visually hidden. */}
      <select
        id={id}
        name={id}
        autoFocus={autoFocus}
        value={value === null ? "" : String(value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        className="sr-only"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>

      {/* Visual wheel (decorative — the select above owns semantics). */}
      <div
        aria-hidden
        className="relative select-none"
        style={{ height: VISIBLE_ROWS * ITEM_H }}
      >
        {/* centered highlight pill, behind the text */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-muted"
          style={{ height: ITEM_H }}
        />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
          }}
        >
          <div style={{ height: PAD }} />
          {options.map((option, i) => {
            const distance = Math.abs(i - centerIndex);
            const isCenter = i === centerIndex;
            return (
              <div
                key={option}
                className={cn(
                  "flex snap-center items-center justify-center text-2xl transition-all",
                  isCenter
                    ? "font-bold text-foreground"
                    : "font-medium text-muted-foreground"
                )}
                style={{
                  height: ITEM_H,
                  opacity: Math.max(0.3, 1 - distance * 0.26),
                  transform: `scale(${Math.max(0.82, 1 - distance * 0.06)})`,
                }}
              >
                {format(option)}
              </div>
            );
          })}
          <div style={{ height: PAD }} />
        </div>
      </div>

      <FieldError message={error} id={errorId} />
    </div>
  );
}
