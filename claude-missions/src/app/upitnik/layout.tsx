import type { ReactNode } from "react";

/**
 * Layout for the public, pre-auth onboarding questionnaire (`/upitnik`).
 *
 * Mirrors the post-auth onboarding layout: full-bleed (the app shell drops its
 * centered column + bottom navigation for this route — see
 * `src/components/shell/app-shell.tsx`), the app's themed canvas
 * (`bg-background`, white in the default light theme) with a safe-area-aware,
 * mobile-width centered column. A logged-out visitor answers
 * the questionnaire and sees their plan inside it, never seeing the app's tab
 * bar (which requires a finished account anyway).
 */
export default function UpitnikLayout({ children }: { children: ReactNode }) {
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
