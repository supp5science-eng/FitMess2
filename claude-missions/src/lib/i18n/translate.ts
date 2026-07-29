import type { Locale } from "@/lib/i18n/locale";
import { messages, type MessageKey } from "@/lib/i18n/messages";

/**
 * A bound translation function. `t("nav.home")` returns the copy for the
 * active locale; `t("greeting", { name })` interpolates `{name}` placeholders.
 * Unknown keys fall back to the Serbian string, then to the key itself, so a
 * missing translation degrades to Serbian (never a blank or a crash).
 */
export type TFunction = (
  key: MessageKey,
  params?: Record<string, string | number>
) => string;

export function createT(locale: Locale): TFunction {
  const dict = messages[locale];
  const fallback = messages.sr;
  return (key, params) => {
    let out = dict[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        out = out.replaceAll(`{${name}}`, String(value));
      }
    }
    return out;
  };
}
