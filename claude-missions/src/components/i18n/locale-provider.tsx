"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { createT, type TFunction } from "@/lib/i18n/translate";

// Makes the active language available to client components. The root layout
// reads the `fm_locale` cookie server-side and passes it in, so `useT()` gives
// the same result the server rendered with (no hydration mismatch). Server
// components read the cookie directly via `@/lib/i18n/server`.

interface LocaleContextValue {
  locale: Locale;
  t: TFunction;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: createT(DEFAULT_LOCALE),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createT(locale) }),
    [locale]
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/** Client-side translation hook: `const { t, locale } = useT()`. */
export function useT(): LocaleContextValue {
  return useContext(LocaleContext);
}
