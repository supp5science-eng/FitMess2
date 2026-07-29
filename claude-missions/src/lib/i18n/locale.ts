// App-wide language (locale). Like the theme, the choice is a per-DEVICE
// preference stored in a cookie (not account data), so the server can render
// the correct copy + `<html lang>` on the very first paint. `applyLocale`
// switches it live on the client and writes the cookie.
//
// This module has no "use client" directive so it can be imported from both
// the server (root layout / server components: `resolveLocale`, `LOCALE_COOKIE`)
// and the client (`applyLocale`). `applyLocale` touches `document`, so it must
// only ever be called from a client event handler -- never during server render.
//
// Only the UI language changes. Calendar/timezone math stays Belgrade
// everywhere (the app is Serbia-first); English users see English copy with
// Belgrade days.

export type Locale = "sr" | "en";

export const LOCALES: readonly Locale[] = ["sr", "en"] as const;

/** Cookie carrying the chosen language. Read server-side in the root layout. */
export const LOCALE_COOKIE = "fm_locale";

/**
 * Default language for anyone without a cookie: Serbian. English is opt-in via
 * Settings; the choice is remembered per-device in `fm_locale`.
 */
export const DEFAULT_LOCALE: Locale = "sr";

/** ~1 year -- the language choice should stick across sessions on this device. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrows an untrusted cookie value to a Locale, falling back to the default. */
export function resolveLocale(value: string | null | undefined): Locale {
  return value === "sr" || value === "en" ? value : DEFAULT_LOCALE;
}

/**
 * Client-only: apply a language immediately (set `<html lang>`) and persist it
 * to the cookie so the next server render agrees. Safe to call from any tap
 * handler; never call during server render (it reads `document`). The caller is
 * expected to `router.refresh()` so server-rendered copy re-renders.
 */
export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
