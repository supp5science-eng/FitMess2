"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

/**
 * iOS-style "drum" wheel picker (like the alarm/time setter). The list
 * scrolls vertically and snaps each value to a centered highlight band; the
 * value under the band is the selection. A short synthesized "tick" plays as
 * each value crosses the center, mirroring the haptic/audio feedback of the
 * native iOS picker.
 *
 * Used by the onboarding height step (F015). Fully controlled: `value` is the
 * selected number, `onChange` fires once per value change. Touch scrolling is
 * the primary interaction on mobile; arrow keys + Home/End provide keyboard
 * a11y for the `role="slider"`.
 */

const ITEM_HEIGHT = 46; // px per row -- must match the CSS below
const VISIBLE_ITEMS = 5; // odd number so one row sits dead-center
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // top/bottom spacer

/**
 * A single lazily-created AudioContext shared by every picker instance. iOS
 * Safari starts it "suspended"; the first scroll (a user gesture) resumes it.
 */
let sharedCtx: AudioContext | null = null;

function playTick() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    if (!sharedCtx) sharedCtx = new Ctor();
    const ctx = sharedCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Short, dry, high-ish click -- soft attack, fast decay ("tock").
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.03);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Audio is a nicety; never let it break the picker.
  }
}

export function WheelPicker({
  min,
  max,
  value,
  onChange,
  suffix,
  ariaLabel,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Last value we reported / ticked on, tracked in a ref so the scroll
  // handler doesn't need to re-bind on every render.
  const lastValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  // Position the drum on the current value without animation on mount and
  // whenever `value` is changed from outside (e.g. reset).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = (value - min) * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
    }
    lastValueRef.current = value;
  }, [value, min]);

  // Report a new value once (guarded so scroll + keyboard can't double-fire).
  function commit(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== lastValueRef.current) {
      lastValueRef.current = clamped;
      playTick();
      onChange(clamped);
    }
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      commit(min + index);
    });
  }

  // Keyboard a11y: arrows step by one, Home/End jump to the bounds. We move
  // the drum immediately; the guarded commit ticks + reports the change.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") next = value + 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft")
      next = value - 1;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    if (next === null) return;
    event.preventDefault();
    select(next);
  }

  // Jump straight to a tapped value (scroll stays the primary mobile gesture;
  // tapping a partly-visible row is a quick shortcut and keeps the wheel
  // testable without synthesizing momentum scroll).
  function select(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    const el = scrollRef.current;
    if (el) el.scrollTop = (clamped - min) * ITEM_HEIGHT;
    commit(clamped);
  }

  return (
    <div
      className="relative mx-auto w-full max-w-xs select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ height: CONTAINER_HEIGHT }}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={suffix ? `${value} ${suffix}` : String(value)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Center highlight band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-primary/30 bg-primary/5"
        style={{ height: ITEM_HEIGHT }}
      />
      {/* Fixed suffix (e.g. "cm") next to the centered value */}
      {suffix ? (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-y-1/2 translate-x-[2.6rem] text-base font-medium text-muted-foreground"
        >
          {suffix}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          maskImage:
            "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
        }}
      >
        <div style={{ height: PAD }} aria-hidden />
        {items.map((n) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              onClick={() => select(n)}
              className={`flex w-full cursor-pointer items-center justify-center border-0 bg-transparent font-sans tabular-nums transition-[color,transform,opacity] duration-100 ${
                selected
                  ? "scale-105 font-semibold text-foreground"
                  : "text-muted-foreground/60"
              }`}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
                fontSize: selected ? 26 : 22,
              }}
            >
              {n}
            </button>
          );
        })}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  );
}
