import type { Locale } from "@/lib/i18n/locale";
import { core } from "@/lib/i18n/messages/core";
import { dodaj } from "@/lib/i18n/messages/dodaj";
import { food } from "@/lib/i18n/messages/food";
import { analitika } from "@/lib/i18n/messages/analitika";
import { onboarding } from "@/lib/i18n/messages/onboarding";
import { auth } from "@/lib/i18n/messages/auth";
import { profil } from "@/lib/i18n/messages/profil";
import { home } from "@/lib/i18n/messages/home";
import { streak } from "@/lib/i18n/messages/streak";
import { misc } from "@/lib/i18n/messages/misc";
import { admin } from "@/lib/i18n/messages/admin";
import { nutrition } from "@/lib/i18n/messages/nutrition";

/**
 * The full UI dictionary, merged from one namespace module per feature area
 * (`messages/*.ts`). Serbian (`sr`) is the source of truth for the key set;
 * each namespace types its `en` against its own `sr`, and the merged `en` below
 * is checked against `MessageKey`, so a missing English string fails the build.
 *
 * A key with no translation for the active locale falls back to Serbian, then
 * to the key itself (see `translate.ts`).
 */
const sr = {
  ...core.sr,
  ...dodaj.sr,
  ...food.sr,
  ...analitika.sr,
  ...onboarding.sr,
  ...auth.sr,
  ...profil.sr,
  ...home.sr,
  ...streak.sr,
  ...misc.sr,
  ...admin.sr,
  ...nutrition.sr,
};

const en = {
  ...core.en,
  ...dodaj.en,
  ...food.en,
  ...analitika.en,
  ...onboarding.en,
  ...auth.en,
  ...profil.en,
  ...home.en,
  ...streak.en,
  ...misc.en,
  ...admin.en,
  ...nutrition.en,
};

export type MessageKey = keyof typeof sr;

export const messages: Record<Locale, Record<MessageKey, string>> = { sr, en };
