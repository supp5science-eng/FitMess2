// App-wide light/dark theme. The choice is a per-DEVICE preference stored in a
// cookie (not account data), so the server can render the correct `class` on
// `<html>` on the very first paint -- no flash of the wrong theme. `applyTheme`
// flips it live on the client and writes the cookie.
//
// This module has no "use client" directive so it can be imported from both
// the server (root layout: `resolveTheme`, `THEME_COOKIE`) and the client
// (`applyTheme`). `applyTheme` touches `document`, so it must only ever be
// called from a client event handler -- never during server render.

export type Theme = "light" | "dark";

/** Cookie carrying the chosen theme. Read server-side in the root layout. */
export const THEME_COOKIE = "fm_theme";

/**
 * Default theme for anyone without a cookie: LIGHT (the app's default look as
 * of 2026-07-21). Users can still switch to dark in onboarding or Settings;
 * the choice is remembered per-device in `fm_theme`.
 */
export const DEFAULT_THEME: Theme = "light";

/** ~1 year -- the theme choice should stick across sessions on this device. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrows an untrusted cookie value to a Theme, falling back to the default. */
export function resolveTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/**
 * Client-only: apply a theme immediately (swap the `<html>` class) and persist
 * it to the cookie so the next server render agrees. Safe to call from any tap
 * handler; never call during server render (it reads `document`).
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}
