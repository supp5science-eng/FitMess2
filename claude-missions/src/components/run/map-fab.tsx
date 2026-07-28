import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MapFabProps extends ComponentPropsWithoutRef<"button"> {
  /** Accessible name — the control is icon-only. */
  label: string;
  children: ReactNode;
  /** Optional caption shown under the button (e.g. "RUN", "SETTINGS"). */
  caption?: string;
  /** Larger 56px variant for the secondary bottom actions. */
  size?: "sm" | "md";
  /** Teal-filled active state (e.g. an engaged 3D / follow toggle). */
  active?: boolean;
}

/**
 * A floating, circular, frosted-glass control that sits over the immersive run
 * map — the single building block for every map button (exit, compass, 3D,
 * recenter, run type, settings). Dark glass by default; `active` fills it with
 * the FitMess teal so a toggled state reads at a glance.
 */
export function MapFab({
  label,
  children,
  caption,
  size = "sm",
  active = false,
  className,
  ...props
}: MapFabProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "liquid-glass inline-flex items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        size === "md" ? "size-14" : "size-11",
        active
          ? "border-primary/40 bg-primary text-primary-foreground"
          : "border-white/10 bg-black/55 text-white hover:bg-black/70",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (!caption) return button;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {button}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/90 drop-shadow">
        {caption}
      </span>
    </div>
  );
}
