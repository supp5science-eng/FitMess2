"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export const WHEEL_ITEM_H = 44; // px per row
export const WHEEL_VISIBLE_ROWS = 5; // odd, so one row is dead-center
const PAD = ((WHEEL_VISIBLE_ROWS - 1) / 2) * WHEEL_ITEM_H;

export interface WheelColumnOption {
  key: string;
  label: string;
}

/**
 * F015: a single iOS-style scroll-snap column (the Cal-AI wheel look). Pure
 * touch/scroll — no native `<select>` — so it never triggers the OS picker
 * overlay. Decorative by itself (`aria-hidden`): the labeled value lives in a
 * hidden input owned by the parent picker, which is what AT + tests drive.
 */
export function WheelColumn({
  options,
  selectedKey,
  onSelect,
  align = "center",
  className,
}: {
  options: WheelColumnOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = selectedKey === null
    ? -1
    : options.findIndex((o) => o.key === selectedKey);
  const [centerIndex, setCenterIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : Math.floor(options.length / 2)
  );

  // Keep the column scrolled to the selected row (mount + external changes).
  // No-op when already centered there, so our own scroll commits don't loop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIndex < 0) return;
    const current = Math.round(el.scrollTop / WHEEL_ITEM_H);
    if (current !== selectedIndex) el.scrollTop = selectedIndex * WHEEL_ITEM_H;
    setCenterIndex(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, options.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H))
    );
    if (idx !== centerIndex) setCenterIndex(idx);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const picked = options[idx];
      if (picked && picked.key !== selectedKey) onSelect(picked.key);
    }, 120);
  }

  const alignClass =
    align === "start"
      ? "justify-start pl-1"
      : align === "end"
        ? "justify-end pr-1"
        : "justify-center";

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn(
        "h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
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
            key={option.key}
            className={cn(
              "flex items-center snap-center whitespace-nowrap text-2xl transition-all",
              alignClass,
              isCenter
                ? "font-bold text-foreground"
                : "font-medium text-muted-foreground"
            )}
            style={{
              height: WHEEL_ITEM_H,
              opacity: Math.max(0.3, 1 - distance * 0.26),
              transform: `scale(${Math.max(0.82, 1 - distance * 0.06)})`,
            }}
          >
            {option.label}
          </div>
        );
      })}
      <div style={{ height: PAD }} />
    </div>
  );
}
