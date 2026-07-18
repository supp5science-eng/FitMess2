"use client";

import { Button } from "@/components/ui/button";

import "./welcome-intro.css";

/**
 * The animated welcome that greets a user the moment they finish signing in,
 * before the questionnaire. It confirms the sign-in and warmly frames why the
 * next step exists (so we can compute their daily budget and tailor the app),
 * with a privacy reassurance and an estimated duration. `onStart` advances the
 * onboarding flow to the actual wizard (`onboarding-flow.tsx`).
 *
 * Motion: a self-drawing success check, then the copy + CTA fade/slide up in
 * sequence (tw-animate-css utilities). All of it collapses to a static screen
 * under `prefers-reduced-motion`.
 */
export function WelcomeIntro({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-7 py-12 text-center">
      <div className="wi-badge animate-in fade-in zoom-in-50 duration-500">
        <svg className="wi-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle
            className="wi-check-circle"
            cx="26"
            cy="26"
            r="24"
            fill="none"
          />
          <path className="wi-check-mark" fill="none" d="M15 27l7 7 15-15" />
        </svg>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-150 duration-700 text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Uspešno si se prijavio/la 🎉
        </h1>
        <p className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-300 duration-700 text-pretty text-[15px] leading-relaxed text-muted-foreground">
          Ostao je još samo jedan korak. Popuni kratak upitnik o svojim
          podacima kako bismo izračunali tvoj dnevni unos i prilagodili
          aplikaciju baš tebi.
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-500 duration-700 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
        <span className="wi-dot" /> Traje oko 30 sekundi
      </div>

      <p className="animate-in fade-in fill-mode-both delay-700 duration-700 max-w-[19rem] text-xs leading-relaxed text-muted-foreground/70">
        Tvoji podaci su strogo zaštićeni i koriste se isključivo u svrhu rada i
        napretka aplikacije.
      </p>

      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-700 duration-700 mt-2 w-full">
        <Button type="button" onClick={onStart} className="w-full" size="lg">
          Započni upitnik
        </Button>
      </div>
    </main>
  );
}
