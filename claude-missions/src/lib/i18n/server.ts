import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  resolveLocale,
  type Locale,
} from "@/lib/i18n/locale";
import { createT, type TFunction } from "@/lib/i18n/translate";

/**
 * Server-side language helpers. `getLocale()` reads the per-device `fm_locale`
 * cookie; `getT()` also returns a bound `t` for the request's locale. Use these
 * in Server Components / route handlers. Client components use the
 * `LocaleProvider` + `useT()` hook instead (both resolve from the same cookie).
 */
export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  } catch {
    // `cookies()` throws when called outside a request scope -- e.g. a unit
    // test that renders a server component in isolation. Degrade to the
    // default language (Serbian) rather than crashing the render.
    return DEFAULT_LOCALE;
  }
}

export async function getT(): Promise<{ locale: Locale; t: TFunction }> {
  const locale = await getLocale();
  return { locale, t: createT(locale) };
}
