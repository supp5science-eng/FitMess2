"use client";

import { useEffect, useRef } from "react";

/**
 * The landing page's hero: the FitMess motion-graphics film, played full-bleed
 * at the top of `/`.
 *
 * It replaces the old hand-drawn CSS re-enactment
 * (`components/landing/hero-demo.tsx`) — the film tells the same story
 * (početna → slikaj obrok → Prizma procenjuje → ring se popuni), but it is the
 * real product recorded, ending on the FitMess wordmark + `fitmess.app`.
 *
 * NO phone frame is drawn around it: the film already carries its own device
 * mockup on a white/pastel backdrop, so wrapping it in the landing's old
 * `.lp .phone` bezel would read as a phone inside a phone. Its white
 * background is why the landing itself is now light — the two are the same
 * surface, and the video edges dissolve into the page.
 *
 * Playback contract (`landing.css` handles the sizing):
 * - `muted` + `playsInline` + `autoPlay` — the only combination iOS Safari and
 *   Chrome will actually autoplay. The source files carry no audio track at
 *   all, so there is nothing to unmute.
 * - `loop` — it is a poster, not a feature film; it just keeps going.
 * - `poster` — the home screen frame, so the hero is never an empty box while
 *   the first bytes arrive (and it is the whole hero under reduced motion).
 *
 * Under `prefers-reduced-motion: reduce` the video is paused back to its first
 * frame, leaving a still of the app — matching how the rest of the landing
 * kills its animations in that mode. That has to happen in JS: `autoplay` is
 * an HTML attribute, and no media query can switch it off.
 *
 * Decorative — the page's heading and CTA carry the meaning — so the whole
 * element is `aria-hidden`, exactly as the demo it replaces was.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    // `matchMedia` is guarded the same way `components/pwa/install-overlay.tsx`
    // guards it: jsdom (and very old WebViews) don't implement it, and the
    // right behaviour there is "leave the video exactly as the markup asked".
    if (!video || typeof window.matchMedia !== "function") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => {
      if (reduced.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        // `play()` rejects when the browser declines autoplay (e.g. Low Power
        // Mode on iOS). The poster stays up in that case, which is a fine
        // outcome — swallow it rather than logging a scary unhandled
        // rejection. Older engines return nothing at all, hence the guard.
        video.play()?.catch(() => {});
      }
    };

    sync();
    reduced.addEventListener("change", sync);
    return () => reduced.removeEventListener("change", sync);
  }, []);

  return (
    <video
      ref={ref}
      className="lp-video"
      poster="/landing/hero-poster.jpg"
      preload="metadata"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/landing/hero.webm" type="video/webm" />
      <source src="/landing/hero.mp4" type="video/mp4" />
    </video>
  );
}
