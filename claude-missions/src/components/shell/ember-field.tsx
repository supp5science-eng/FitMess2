"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient ember field (2026-08-25) — the redesign's living background: a
 * sparse drift of glowing sparks rising and dark ash flakes falling through
 * the app column, the reading of embers around a temple at dusk. Sits with
 * the aurora behind ALL content (`-z-10` in `AppShell`), decorative and
 * inert.
 *
 * Budget rules, in order of importance:
 * - `prefers-reduced-motion: reduce` → the component renders NOTHING. Not a
 *   paused field: for a motion-sensitive user an ambient particle layer has
 *   no still state worth keeping.
 * - The rAF loop stops entirely when the tab is hidden (visibilitychange)
 *   and on unmount; no timers survive.
 * - ~26 particles, one canvas, additive-free painting — a mid-range phone
 *   never notices it. DPR is capped at 2 so a 3× screen doesn't triple the
 *   pixel work.
 * - Particles advance by real dt (clamped), so a dropped frame drifts,
 *   never teleports.
 */

interface Particle {
  /** Kind: a glowing spark rising, or an ash flake falling. */
  kind: "ember" | "ash";
  x: number; // 0..1 of width
  y: number; // px
  /** Vertical speed, px/s (negative = up). */
  vy: number;
  /** Horizontal sway: amplitude (px), frequency (rad/s), phase. */
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  /** Radius px (ember) / half-size px (ash). */
  r: number;
  /** Base opacity; embers also flicker around it. */
  alpha: number;
  /** Flicker frequency (embers), rotation speed rad/s (ash). */
  aux: number;
}

const COUNT = 26;
const EMBER_SHARE = 0.62;

function spawn(h: number, atEdge: boolean): Particle {
  const isEmber = Math.random() < EMBER_SHARE;
  if (isEmber) {
    return {
      kind: "ember",
      x: Math.random(),
      // Rising: start at (or spread across, on first fill) the bottom.
      y: atEdge ? h + 6 : Math.random() * h,
      vy: -(8 + Math.random() * 16),
      swayAmp: 6 + Math.random() * 14,
      swayFreq: 0.4 + Math.random() * 0.8,
      swayPhase: Math.random() * Math.PI * 2,
      r: 0.8 + Math.random() * 1.6,
      alpha: 0.35 + Math.random() * 0.45,
      aux: 1.5 + Math.random() * 3,
    };
  }
  return {
    kind: "ash",
    x: Math.random(),
    y: atEdge ? -6 : Math.random() * h,
    vy: 10 + Math.random() * 18,
    swayAmp: 8 + Math.random() * 18,
    swayFreq: 0.3 + Math.random() * 0.5,
    swayPhase: Math.random() * Math.PI * 2,
    r: 1.2 + Math.random() * 1.6,
    alpha: 0.14 + Math.random() * 0.16,
    aux: (Math.random() - 0.5) * 2,
  };
}

export function EmberField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined" || !window.matchMedia) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    const particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function fill() {
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) particles.push(spawn(height, false));
    }

    function frame(now: number) {
      if (!running || !ctx) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;

      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.y += p.vy * dt;
        const offEdge = p.kind === "ember" ? p.y < -8 : p.y > height + 8;
        if (offEdge) {
          particles[i] = spawn(height, true);
          continue;
        }
        const x =
          p.x * width + Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp;

        if (p.kind === "ember") {
          // A spark: hot core + soft glow, opacity breathing at its own rate.
          const flicker =
            p.alpha * (0.72 + 0.28 * Math.sin(t * p.aux + p.swayPhase));
          const glow = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r * 4);
          glow.addColorStop(0, `rgba(255, 178, 143, ${flicker})`);
          glow.addColorStop(0.45, `rgba(255, 90, 60, ${flicker * 0.5})`);
          glow.addColorStop(1, "rgba(255, 90, 60, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // An ash flake / dark petal: a thin rotated sliver, barely there.
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(t * p.aux + p.swayPhase);
          ctx.fillStyle = `rgba(217, 160, 141, ${p.alpha})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.6, p.r * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }
    // Flipping reduced-motion on mid-session tears the field down for good;
    // (re-enabling it needs a reload, which is fine for an OS-level setting).
    function onReduceChange() {
      if (reduce.matches) {
        stop();
        ctx?.clearRect(0, 0, width, height);
      }
    }

    resize();
    fill();
    start();
    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", onReduceChange);
    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onReduceChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ember-field"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
