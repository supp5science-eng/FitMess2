"use client";

import { useEffect, useRef } from "react";

/** Festive palette that pops on the dark success overlay. */
const COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  sway: number;
  color: string;
  shape: "rect" | "circle";
}

/**
 * A hand-rolled canvas confetti burst (no dependency, matching the codebase's
 * "hand-rolled visuals" convention). Fires once on mount, rains for ~3.2s with
 * gravity + sway + rotation, fades out, then stops. `aria-hidden` — purely
 * decorative. In jsdom `getContext` is null, so it no-ops cleanly in tests.
 */
export function ConfettiCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    function resize() {
      if (!canvas || !ctx) return;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const COUNT = 150;
    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => ({
      // Vary spawn by index so no Math.random is needed for determinism-safety;
      // randomness here is purely cosmetic and fine.
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.5,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 2.2 + Math.random() * 3.4,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      sway: (i / COUNT) * Math.PI * 2,
      color: COLORS[i % COLORS.length],
      shape: i % 2 === 0 ? "rect" : "circle",
    }));

    const DURATION = 3200;
    const FADE_MS = 900;
    let raf = 0;
    let start: number | null = null;

    function frame(t: number) {
      if (!ctx) return;
      if (start === null) start = t;
      const elapsed = t - start;
      const fade = Math.max(0, 1 - Math.max(0, elapsed - (DURATION - FADE_MS)) / FADE_MS);

      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.sway += 0.05;
        p.x += p.vx + Math.sin(p.sway) * 0.7;
        p.y += p.vy;
        p.rot += p.vr;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < DURATION) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
