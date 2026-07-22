"use client";

import { useEffect, useRef, useState } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TICK_GAP = 12; // px between adjacent ticks

/**
 * F015: an inline horizontal "ruler" picker (Cal-AI weight look) — a big live
 * readout over a scrollable tick strip with a fixed center indicator.
 *
 * Same accessibility contract as WheelPicker: a visually-hidden native
 * `<select>` is the source of truth (labeled, keyboard-reachable, drives
 * `getByLabelText`); the ruler is `aria-hidden` and mirrors/commits the value.
 * The store stays metric; `renderReadout` only changes the display.
 */
export function RulerPicker({
  id,
  label,
  caption,
  value,
  onChange,
  options,
  error,
  renderReadout,
}: {
  id: string;
  label: string;
  caption?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: number[];
  error?: string;
  renderReadout?: (value: number) => string;
}) {
  const errorId = `${id}-error`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = value === null ? -1 : options.indexOf(value);
  const [centerIndex, setCenterIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : Math.floor(options.length / 2)
  );

  const readout = (v: number) => (renderReadout ? renderReadout(v) : String(v));
  const centerValue = options[Math.min(centerIndex, options.length - 1)];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIndex < 0) return;
    const current = Math.round(el.scrollLeft / TICK_GAP);
    if (current !== selectedIndex) {
      el.scrollLeft = selectedIndex * TICK_GAP;
    }
    setCenterIndex(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollLeft / TICK_GAP))
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
      <input
        id={id}
        name={id}
        type="text"
        inputMode="none"
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
      />

      {/* Big live readout */}
      <div className="mb-2 flex flex-col items-center gap-1" aria-hidden>
        {caption ? (
          <span className="text-sm text-muted-foreground">{caption}</span>
        ) : null}
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {centerValue !== undefined ? readout(centerValue) : ""}
        </span>
      </div>

      {/* Visual ruler (decorative — the select above owns semantics). */}
      <div aria-hidden className="relative select-none">
        {/* fixed center indicator */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-10 w-0.5 -translate-x-1/2 rounded-full bg-foreground" />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory items-start overflow-x-auto scroll-smooth px-[50%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
          }}
        >
          {options.map((option, i) => {
            const major = i % 5 === 0;
            return (
              <div
                key={option}
                className="flex shrink-0 snap-center justify-center"
                style={{ width: TICK_GAP }}
              >
                <div
                  className={cn(
                    "w-px rounded-full",
                    major ? "h-10 bg-muted-foreground/70" : "h-6 bg-border"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      <FieldError message={error} id={errorId} />
    </div>
  );
}
