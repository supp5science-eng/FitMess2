"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfettiCanvas } from "@/components/onboarding/confetti-canvas";
import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { buildCommitment } from "@/lib/onboarding/commitment";
import type { CommitmentInput } from "@/lib/onboarding/commitment";
import { cn } from "@/lib/utils";

const HOLD_MS = 2800; // press-and-hold duration to fully commit (time to read the pledge)
const CELEBRATE_MS = 2300; // celebration before auto-advancing
const FLOOD_D = 2400; // diameter of the screen-flood circle (covers any phone)
const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Motion-graphics for the intro beat. Scoped `fm-intro-*` class names +
 * keyframes injected via a local <style> so nothing leaks into the shared
 * `globals.css` (other agents work there). Everything is a staggered entrance
 * plus a couple of gentle looping accents (aura breathe, sonar rings, glow),
 * fully disabled under `prefers-reduced-motion`.
 */
const INTRO_KEYFRAMES = `
@keyframes fmIntroPop {
  0%   { opacity: 0; transform: translateY(16px) scale(.72); filter: blur(6px); }
  60%  { opacity: 1; filter: blur(0); }
  78%  { transform: translateY(0) scale(1.05); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes fmIntroRise {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fmIntroRing {
  0%   { opacity: .5;  transform: scale(.62); }
  100% { opacity: 0;   transform: scale(1.85); }
}
@keyframes fmIntroAura {
  0%,100% { opacity: .5;  transform: translate(-50%, -50%) scale(1); }
  50%     { opacity: .85; transform: translate(-50%, -50%) scale(1.12); }
}
@keyframes fmIntroGlow {
  0%,100% { opacity: .35; }
  50%     { opacity: .7; }
}
@keyframes fmIntroSheen {
  0%       { background-position: -160% 0; }
  55%,100% { background-position: 260% 0; }
}

.fm-intro-aura {
  background: radial-gradient(circle at center,
    color-mix(in srgb, var(--primary) 34%, transparent) 0%,
    color-mix(in srgb, var(--primary) 12%, transparent) 42%,
    transparent 70%);
  animation: fmIntroAura 4.6s ease-in-out infinite;
}
.fm-intro-logo    { animation: fmIntroPop .8s cubic-bezier(.2,.7,.2,1) .05s both; }
.fm-intro-glow {
  position: absolute;
  inset: -30%;
  border-radius: 9999px;
  background: radial-gradient(circle at center,
    color-mix(in srgb, var(--primary) 55%, transparent) 0%, transparent 68%);
  filter: blur(14px);
  animation: fmIntroGlow 3s ease-in-out .6s infinite;
}
.fm-ring {
  position: absolute;
  width: 6rem; height: 6rem;
  border-radius: 9999px;
  border: 2px solid color-mix(in srgb, var(--primary) 70%, transparent);
}
.fm-ring-1 { animation: fmIntroRing 2.8s ease-out .7s infinite; }
.fm-ring-2 { animation: fmIntroRing 2.8s ease-out 1.7s infinite; }

.fm-intro-title {
  background-image: linear-gradient(100deg,
    var(--foreground) 28%, var(--primary) 50%, var(--foreground) 72%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: fmIntroRise .6s cubic-bezier(.2,.7,.2,1) .35s both,
             fmIntroSheen 3.4s ease-in-out 1.2s infinite;
}
.fm-intro-copy { animation: fmIntroRise .6s cubic-bezier(.2,.7,.2,1) .55s both; }
.fm-intro-warn { animation: fmIntroRise .6s cubic-bezier(.2,.7,.2,1) .82s both; }
.fm-intro-cta  { animation: fmIntroRise .6s cubic-bezier(.2,.7,.2,1) 1.05s both; }

@media (prefers-reduced-motion: reduce) {
  .fm-intro-aura, .fm-intro-logo, .fm-intro-glow, .fm-ring,
  .fm-intro-title, .fm-intro-copy, .fm-intro-warn, .fm-intro-cta {
    animation: none !important;
  }
  .fm-ring { display: none; }
  .fm-intro-title { color: var(--foreground); }
}
`;

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration is a nice-to-have; ignore engagement-gated throws.
  }
}

/**
 * The "place your finger" seal: our logo at the centre, hand-rolled fingerprint
 * ridges around it, a progress ring that fills as you hold, and a dashed ring
 * that spins while pressed. Decorative (`aria-hidden`).
 */
function FingerprintSeal({
  progress,
  holding,
  size = 44,
}: {
  progress: number;
  holding: boolean;
  size?: number;
}) {
  return (
    <div className="relative size-full" aria-hidden>
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full">
        <circle cx="60" cy="60" r="58" className="fill-neutral-900" />
        {/* fingerprint ridges */}
        {[22, 28, 34, 40, 46].map((r, i) => (
          <circle
            key={r}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            className="stroke-white/25"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={`${r * 1.5} ${r * 0.8}`}
            strokeDashoffset={i * 5}
            transform={`rotate(${i * 26} 60 60)`}
          />
        ))}
        {/* progress ring */}
        <circle
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          className="stroke-white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - progress)}
          transform="rotate(-90 60 60)"
          style={{
            transition: progress === 0 ? "stroke-dashoffset 250ms ease" : "none",
          }}
        />
      </svg>
      {/* spinning dashed ring while holding */}
      <svg
        viewBox="0 0 120 120"
        className={cn(
          "absolute inset-0 size-full",
          holding && "animate-spin [animation-duration:2.6s]"
        )}
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          className={holding ? "stroke-white/60" : "stroke-white/0"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="3 12"
        />
      </svg>
      {/* our logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Image
          src="/brand/fitmess-icon.png"
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="pointer-events-none rounded-xl select-none [-webkit-touch-callout:none]"
          priority
        />
      </div>
    </div>
  );
}

/**
 * End-of-questionnaire commitment moment. Two beats: an intro ("everything's
 * ready — now promise yourself something") then the press-and-hold seal that
 * floods the screen from your finger as the ring spins. Completing it fires a
 * confetti celebration and auto-advances via `onCommitted`. Keyboard/AT users
 * activate with Enter/Space (no long hold required).
 */
export function CommitScreen({
  data,
  onCommitted,
}: {
  data: CommitmentInput;
  onCommitted: () => void;
}) {
  const commitment = buildCommitment(data);
  const female = data.sex === "female";

  const [phase, setPhase] = useState<"intro" | "hold">("intro");
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const pointerUsedRef = useRef(false);

  const cancelRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const captureOrigin = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, []);

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    holdingRef.current = false;
    cancelRaf();
    captureOrigin();
    setHolding(false);
    setProgress(1);
    setDone(true);
    vibrate([14, 45, 14, 45, 26]);
  }, [captureOrigin]);

  const startHold = useCallback(() => {
    if (doneRef.current || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = null;
    captureOrigin();
    setHolding(true);
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
  }, [captureOrigin, complete]);

  const releaseHold = useCallback(() => {
    if (doneRef.current || !holdingRef.current) return;
    holdingRef.current = false;
    cancelRaf();
    startRef.current = null;
    setHolding(false);
    setProgress(0); // springs back
  }, []);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onCommitted, CELEBRATE_MS);
    return () => clearTimeout(id);
  }, [done, onCommitted]);

  useEffect(() => () => cancelRaf(), []);

  if (phase === "intro") {
    return (
      <div className="relative flex flex-1 flex-col gap-6 overflow-hidden px-6 py-8">
        <style>{INTRO_KEYFRAMES}</style>

        {/* Ambient breathing aura behind everything — soft brand-teal glow. */}
        <div
          aria-hidden
          className="fm-intro-aura pointer-events-none absolute left-1/2 top-[38%] -z-10 size-[min(120vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        />

        <ProgressIndicator currentStep={9} totalSteps={10} />

        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          {/* Logo with expanding sonar rings + pulsing glow. */}
          <div className="fm-intro-logo relative grid place-items-center">
            <span aria-hidden className="fm-ring fm-ring-1" />
            <span aria-hidden className="fm-ring fm-ring-2" />
            <div aria-hidden className="fm-intro-glow" />
            <div className="relative size-24 overflow-hidden rounded-3xl shadow-[0_18px_50px_-12px_rgba(23,209,168,0.5)] ring-1 ring-white/10">
              <Image
                src="/brand/fitmess-icon.png"
                alt=""
                width={96}
                height={96}
                draggable={false}
                className="pointer-events-none size-full select-none [-webkit-touch-callout:none]"
                priority
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="fm-intro-title text-3xl font-bold tracking-tight">
              Sve je spremno
            </h2>
            <p className="fm-intro-copy mx-auto max-w-sm text-lg leading-relaxed text-muted-foreground">
              Ali pre nego što zakoračiš u sve što sledi, moraš nešto da obećaš{" "}
              <span className="font-semibold text-foreground">sebi</span>.
            </p>
          </div>

          {/* "No going back" disclaimer — deliberately weighty. */}
          <div className="fm-intro-warn mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3 text-left">
            <span
              aria-hidden
              className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-foreground/5 text-foreground"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
                <rect
                  x="5"
                  y="10.5"
                  width="14"
                  height="9.5"
                  rx="2.4"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Kad si {female ? "stigla" : "stigao"} dovde, više ne postoji dugme za
              nazad.{" "}
              <span className="font-semibold text-foreground">
                Ili nastavljaš, ili ostaješ na istom.
              </span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setPhase("hold")}
          className="fm-intro-cta h-14 w-full rounded-full text-base font-semibold"
        >
          Nastavi
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col gap-6 px-6 py-8">
      <ProgressIndicator currentStep={10} totalSteps={10} />
      <h2 className="text-3xl font-bold tracking-tight text-foreground">
        Posveti se svom cilju
      </h2>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* commitment bubble */}
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
          ref={buttonRef}
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
            // preceding pointer gesture — commit at once, no long hold needed.
            if (e.detail === 0 && !pointerUsedRef.current) complete();
            pointerUsedRef.current = false;
          }}
          // Stop iOS's long-press "Save Image / Copy" callout on the held seal.
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative z-10 size-40 touch-none rounded-full outline-none select-none transition-transform [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50",
            holding ? "scale-95" : "scale-100"
          )}
        >
          <FingerprintSeal progress={progress} holding={holding} />
        </button>

        <p className="text-center text-sm font-semibold text-foreground">
          Pritisni i drži da se obavežeš
        </p>
      </div>

      {/* screen flood — grows from the finger as you hold */}
      {progress > 0 || done ? (
        <div
          className="pointer-events-none fixed z-40 rounded-full bg-neutral-950"
          style={{
            left: origin.x,
            top: origin.y,
            width: FLOOD_D,
            height: FLOOD_D,
            marginLeft: -FLOOD_D / 2,
            marginTop: -FLOOD_D / 2,
            transform: `scale(${done ? 1 : progress})`,
            transition: holding ? "none" : "transform 300ms ease",
          }}
        />
      ) : null}

      {/* celebration (sits on top of the now-flooded screen) */}
      {done ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <ConfettiCanvas className="pointer-events-none absolute inset-0 size-full" />
          <div className="mb-2 size-24 animate-in zoom-in-90 duration-500">
            <FingerprintSeal progress={1} holding={false} size={56} />
          </div>
          <h3 className="animate-in fade-in zoom-in-95 text-3xl font-bold text-white duration-500">
            Posvećeno 🤝
          </h3>
          <p className="animate-in fade-in text-lg text-white/80 duration-700">
            Ovo je prvi korak ka mom cilju.
          </p>
        </div>
      ) : null}
    </div>
  );
}
