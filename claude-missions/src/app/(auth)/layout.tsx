import type { ReactNode } from "react";

import "./auth.css";

/**
 * Shared chrome for the auth screens (`/prijava`, `/registracija`,
 * `/registracija/proveri-email`).
 *
 * These routes render full-bleed (the app shell drops its centered white
 * column + bottom nav for them — see `src/components/shell/app-shell.tsx`), so
 * this layout owns the whole viewport: a clean white canvas matching the
 * marketing landing, the FitMess wordmark up top, and a safe-area-aware
 * centered column. Each page fills in its own card (`.auth-card`).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-shell">
        <div className="auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/fitmess-icon.png" alt="FitMess" width={34} height={34} />
          <b>
            {/* "Mess" wears the logo's iridescent pear gradient — same
                `.fm-wordmark-accent` (globals.css, theme-aware) as the home
                screen's wordmark, so auth + code-entry match the brand mark. */}
            Fit<span className="fm-wordmark-accent">Mess</span>
          </b>
        </div>
        {children}
      </div>
    </div>
  );
}
