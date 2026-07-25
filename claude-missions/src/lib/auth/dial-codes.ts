/**
 * Country dial codes offered wherever we ask for a phone number (signup, the
 * `/telefon` capture gate, and "Broj telefona" in Podešavanja). Serbia (+381)
 * is first and the default; the rest are the neighbouring countries plus the
 * common Serbian-diaspora destinations, so most users find theirs without a
 * huge list. Flags are plain emoji (render natively on iOS, our only real
 * target).
 *
 * Lives here rather than next to one of the forms so the three places that ask
 * for a number can never drift into offering different countries.
 */
export const DIAL_CODES = [
  { code: "+381", flag: "🇷🇸", name: "Srbija" },
  { code: "+387", flag: "🇧🇦", name: "Bosna i Hercegovina" },
  { code: "+382", flag: "🇲🇪", name: "Crna Gora" },
  { code: "+385", flag: "🇭🇷", name: "Hrvatska" },
  { code: "+389", flag: "🇲🇰", name: "Severna Makedonija" },
  { code: "+386", flag: "🇸🇮", name: "Slovenija" },
  { code: "+49", flag: "🇩🇪", name: "Nemačka" },
  { code: "+43", flag: "🇦🇹", name: "Austrija" },
  { code: "+41", flag: "🇨🇭", name: "Švajcarska" },
  { code: "+33", flag: "🇫🇷", name: "Francuska" },
  { code: "+39", flag: "🇮🇹", name: "Italija" },
  { code: "+46", flag: "🇸🇪", name: "Švedska" },
  { code: "+44", flag: "🇬🇧", name: "Velika Britanija" },
  { code: "+1", flag: "🇺🇸", name: "SAD / Kanada" },
  { code: "+61", flag: "🇦🇺", name: "Australija" },
] as const;

export const DEFAULT_DIAL_CODE = "+381";

/**
 * Inverse of `normalizePhone`: takes the stored E.164 number and splits it back
 * into the picker value + the locally-typed part, so an edit form can show the
 * number the user already gave instead of an empty field.
 *
 * Longest dial code wins (+385 must beat +38 style prefixes, +41 must beat +4),
 * and an unrecognised country falls back to keeping the whole number visible
 * under the default code -- never silently dropping digits the user would then
 * re-save wrong.
 */
export function splitPhone(phone: string | null | undefined): {
  dialCode: string;
  local: string;
} {
  const trimmed = (phone ?? "").trim();
  if (!trimmed.startsWith("+")) {
    return { dialCode: DEFAULT_DIAL_CODE, local: trimmed.replace(/\D/g, "") };
  }

  const match = [...DIAL_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((country) => trimmed.startsWith(country.code));

  if (!match) {
    return { dialCode: DEFAULT_DIAL_CODE, local: trimmed.slice(1) };
  }

  return { dialCode: match.code, local: trimmed.slice(match.code.length) };
}
