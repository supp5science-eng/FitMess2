import type { ReactNode } from "react";

/**
 * Layout for the public, pre-auth onboarding questionnaire (`/upitnik`).
 *
 * Mirrors the post-auth onboarding layout: full-bleed (the app shell drops its
 * centered column + bottom navigation for this route — see
 * `src/components/shell/app-shell.tsx`), the app's themed canvas
 * (`bg-background`) with a safe-area-aware, mobile-width centered column. A
 * logged-out visitor answers the questionnaire and sees their plan inside it,
 * never seeing the app's tab bar (which requires a finished account anyway).
 *
 * Redesign 2026-08-25: the questionnaire is EXPLICITLY excluded from the
 * "Žar" (dark ember) redesign, so this subtree pins the retired "Gravira"
 * palette via the `.light` class (see `globals.css`) — blue ink on warm
 * paper, exactly as it shipped.
 */
export default function UpitnikLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="light min-h-dvh bg-background text-foreground"
      style={{ colorScheme: "light" }}
    >
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
