import type { ReactNode } from "react";

/**
 * Layout for the whole onboarding subtree (`/onboarding`, `/onboarding/pregled`).
 *
 * The onboarding flow is full-bleed (see `src/components/shell/app-shell.tsx`):
 * the app shell drops its centered column + bottom navigation here, so this
 * layout owns the viewport — a dark, near-black canvas (the app runs dark)
 * with a safe-area-aware, mobile-width centered column. The post-login
 * welcome, the questionnaire and its summary all render inside it, none of
 * them showing the Danas/Nedelja/Agent/Profil tabs until onboarding is done.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
