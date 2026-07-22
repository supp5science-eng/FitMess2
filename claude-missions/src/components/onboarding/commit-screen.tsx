"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ConfettiCanvas } from "@/components/onboarding/confetti-canvas";
import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { buildCommitment } from "@/lib/onboarding/commitment";
import type { CommitmentInput } from "@/lib/onboarding/commitment";
import { cn } from "@/lib/utils";

const HOLD_MS = 1100; // press-and-hold duration to commit
const CELEBRATE_MS = 2100; // success moment before auto-advancing
const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration is a nice-to-have; ignore engagement-gated throws.
  }
}

/** The dark "commit seal": apple glyph + concentric arcs, with a progress ring
 *  that fills as you hold. Decorative (`aria-hidden`). */
function CommitSeal({ progress }: { progress: number }) {
  return (
    <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
      <circle cx="60" cy="60" r="58" className="fill-neutral-900" />
      {/* decorative concentric arcs */}
      <path
        d="M34 50a34 30 0 0 1 52 0"
        className="stroke-white/30"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M40 44a26 24 0 0 1 40 0"
        className="stroke-white/50"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* bottom measuring ticks */}
      {Array.from({ length: 11 }).map((_, i) => {
        const angle = Math.PI * (0.62 + (i / 10) * 0.76);
        const x1 = 60 + Math.cos(angle) * 40;
        const y1 = 60 + Math.sin(angle) * 40;
        const x2 = 60 + Math.cos(angle) * 46;
        const y2 = 60 + Math.sin(angle) * 46;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="stroke-white/40"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
      {/* apple */}
      <path
        d="M50 58c-5 3-8 9-6 16 1.5 6 6 12 10 12 2 0 4-1 6-1s4 1 6 1c4 0 8.5-6 10-12 2-7-1-13-6-16-3-2-7-2-10 0-3-2-7-2-10 0z"
        className="fill-white"
      />
      <path d="M60 55c0-4 3-8 8-8 0 4-3 8-8 8z" className="fill-white" />
      {/* progress ring */}
      <circle
        cx="60"
        cy="60"
        r={RING_R}
        fill="none"
        className="stroke-white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - progress)}
        transform="rotate(-90 60 60)"
        style={{ transition: progress === 0 ? "stroke-dashoffset 250ms ease" : "none" }}
      />
    </svg>
  );
}

/**
 * End-of-questionnaire "commit to your goal" moment. Shows a personalized
 * pledge (built from the data the user already entered) and a press-and-hold
 * seal; completing the hold fires a confetti celebration, then auto-advances
 * via `onCommitted`. Keyboard/AT users activate it with Enter/Space (no long
 * hold required).
 */
export function CommitScreen({
  data,
  onCommitted,
}: {
  data: CommitmentInput;
  onCommitted: () => void;
}) {
  const commitment = buildCommitment(data);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const pointerUsedRef = useRef(false);

  const cancelRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    holdingRef.current = false;
    cancelRaf();
    setProgress(1);
    setDone(true);
    vibrate([12, 40, 12, 40, 24]);
  }, []);

  const startHold = useCallback(() => {
    if (doneRef.current || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = null;
    const loop = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        complete();
        return;
      }
      if (holdingRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [complete]);

  const releaseHold = useCallback(() => {
    if (doneRef.current || !holdingRef.current) return;
    holdingRef.current = false;
    cancelRaf();
    startRef.current = null;
    setProgress(0); // spring back
  }, []);

  // Auto-advance once the celebration has played.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onCommitted, CELEBRATE_MS);
    return () => clearTimeout(id);
  }, [done, onCommitted]);

  useEffect(() => () => cancelRaf(), []);

  return (
    <div className="relative flex flex-1 flex-col gap-6 px-6 py-8">
      <ProgressIndicator currentStep={10} totalSteps={10} />

      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        Posveti se svom cilju
      </h2>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* speech bubble */}
        <div className="relative max-w-sm rounded-3xl bg-muted px-6 py-5 text-lg leading-relaxed">
          <p className="text-muted-foreground">
            {commitment.intro}{" "}
            <span className="font-bold text-foreground">
              {commitment.emphasis}
            </span>
            .
          </p>
          <p className="mt-3 text-muted-foreground">{commitment.pledge}</p>
          <div className="absolute -bottom-2 left-1/2 size-5 -translate-x-1/2 rotate-45 rounded-[4px] bg-muted" />
        </div>

        {/* hold-to-commit seal */}
        <button
          type="button"
          aria-label="Pritisni i drži da se obavežeš"
          onPointerDown={(e) => {
            e.preventDefault();
            pointerUsedRef.current = true;
            startHold();
          }}
          onPointerUp={releaseHold}
          onPointerLeave={releaseHold}
          onPointerCancel={releaseHold}
          onClick={(e) => {
            // Keyboard/AT activation (Enter/Space) reports detail 0 with no
            // preceding pointer gesture — commit immediately, no long hold.
            // Pointer interactions (incl. their trailing click) go through hold.
            if (e.detail === 0 && !pointerUsedRef.current) {
              complete();
            }
            pointerUsedRef.current = false;
          }}
          className={cn(
            "relative size-36 touch-none rounded-full outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50",
            progress > 0 && !done ? "scale-95" : "scale-100"
          )}
        >
          <CommitSeal progress={progress} />
        </button>

        <p className="text-center text-sm font-semibold text-foreground">
          Pritisni i drži da se obavežeš
        </p>
      </div>

      {/* success overlay */}
      {done ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center">
          <ConfettiCanvas className="pointer-events-none absolute inset-0 size-full" />
          <h3 className="animate-in fade-in zoom-in-95 text-3xl font-bold text-white duration-500">
            Posvećeno 🤝
          </h3>
          <p className="animate-in fade-in text-lg text-white/80 duration-700">
            Ovo je prvi korak ka mom cilju.
          </p>
          <div className="mt-4 size-28 animate-in zoom-in-90 duration-500">
            <CommitSeal progress={1} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
