import {
  Bell,
  BookOpen,
  CircleUserRound,
  Download,
  FileText,
  Footprints,
  Languages,
  LifeBuoy,
  LogOut,
  Phone,
  Scale,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Target,
  Trash2,
  User,
  UtensilsCrossed,
} from "lucide-react";

import { signOutAction } from "../actions";
import { DeleteAccountDialog } from "@/components/profil/delete-account-dialog";
import { MedicalDisclaimer } from "@/components/settings/medical-disclaimer";
import { RefreshAppButton } from "@/components/settings/refresh-app-button";
import { SettingsGroup } from "@/components/settings/settings-group";
import {
  SettingsInfoRow,
  SettingsLinkRow,
} from "@/components/settings/settings-row";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { CONTROLLER } from "@/lib/legal/controller";
import { createClient } from "@/lib/supabase/server";

/**
 * `/profil` -- the "Podešavanja" (Settings) screen.
 *
 * Redesigned (2026-07-19) from a flat stack of buttons into grouped,
 * iOS-style settings sections (`SettingsGroup` + `SettingsLinkRow`), styled
 * entirely from the app's theme tokens rather than inline colour. Server
 * Component: identity/email come from the locally
 * verified access token (`getCurrentUser`, no Auth round trip); a single
 * own-row `profiles` read (RLS `profiles_select_own`) fetches `is_admin` (to
 * decide whether to show the Admin link) and `phone` (shown/edited in the
 * Nalog group). `middleware.ts` already guarantees an authenticated user
 * reaches here; every read degrades gracefully rather than blanking the
 * screen.
 *
 * The only interactive pieces needing client JS are isolated into their own
 * `"use client"` components (`RefreshAppButton`, `DeleteAccountDialog`); the
 * rest is server-rendered links/forms.
 */

/**
 * Support goes to the same address the privacy policy names as the contact for
 * data requests — one mailbox, read by one person.
 *
 * It used to be `podrska@fitmess.app`, which was a placeholder: the domain is
 * verified in Resend for *sending*, so nothing was ever delivered to it. A
 * privacy policy that publishes an unreachable address is worse than one that
 * publishes a plain personal address, because a data-subject request has a
 * legal deadline and a store reviewer who gets no answer rejects the app.
 */
const SUPPORT_EMAIL = CONTROLLER.email;
const APP_VERSION = "0.1.0";

export default async function ProfilPage() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser(supabase);
  const email = currentUser?.email ?? null;

  let isAdmin = false;
  let phone: string | null = null;
  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, phone")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    isAdmin = profile?.is_admin === true;
    phone = profile?.phone ?? null;
  }

  const { t, locale } = await getT();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="px-1 text-2xl font-semibold tracking-tight text-foreground">
        {t("settings.title")}
      </h1>

      <SettingsGroup title={t("settings.group.account")}>
        <SettingsInfoRow
          icon={User}
          label={t("settings.email")}
          value={email ?? "—"}
        />
        {/* `/profil/telefon`, NOT `/telefon`: the latter is the first-run
            capture gate (empty field, no way back, exits to /danas). */}
        <SettingsLinkRow
          href="/profil/telefon"
          icon={Phone}
          label={t("settings.phone")}
          value={phone ?? t("settings.phone.add")}
        />
        <SettingsLinkRow
          href="/profil/lozinka"
          icon={Shield}
          label={t("settings.password")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.group.goal")}>
        {/* Points at the onboarding route rather than a `/profil/*` page of its
            own: that screen already IS "your klon" -- it shows the existing one
            with "Napravi ponovo", and falls back to the picker when there is
            none. A second copy would be two screens to keep in step for no gain. */}
        <SettingsLinkRow
          href="/onboarding/klon"
          icon={CircleUserRound}
          label={t("settings.klon")}
          description={t("settings.klon.desc")}
        />
        <SettingsLinkRow
          href="/profil/cilj"
          icon={Target}
          label={t("settings.goal")}
          description={t("settings.goal.desc")}
        />
        <SettingsLinkRow
          href="/profil/podaci"
          icon={SlidersHorizontal}
          label={t("settings.personal")}
          description={t("settings.personal.desc")}
        />
        <SettingsLinkRow
          href="/profil/koraci"
          icon={Footprints}
          label={t("settings.steps")}
          description={t("settings.steps.desc")}
        />
        <SettingsLinkRow
          href="/profil/merenje"
          icon={Scale}
          label={t("settings.weighIn")}
          description={t("settings.weighIn.desc")}
        />
        <SettingsLinkRow
          href="/profil/pravila"
          icon={UtensilsCrossed}
          label={t("settings.habits")}
          description={t("settings.habits.desc")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.group.app")}>
        <SettingsInfoRow
          icon={Languages}
          label={t("settings.language")}
          trailing={<LanguageToggle initialLocale={locale} />}
        />
        <SettingsLinkRow
          href="/profil/podsetnici"
          icon={Bell}
          label={t("settings.reminders")}
          description={t("settings.reminders.desc")}
        />
        <RefreshAppButton />
      </SettingsGroup>

      {isAdmin ? (
        <SettingsGroup title={t("settings.group.admin")}>
          <SettingsLinkRow
            href="/admin"
            icon={Shield}
            label={t("settings.admin")}
          />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={t("settings.group.privacy")}>
        <SettingsLinkRow
          href="/profil/moji-podaci"
          icon={Download}
          label={t("settings.mydata")}
          description={t("settings.mydata.desc")}
        />
        <SettingsLinkRow
          href="/profil/privatnost"
          icon={FileText}
          label={t("settings.privacy")}
        />
        <SettingsLinkRow
          href="/profil/uslovi"
          icon={ScrollText}
          label={t("settings.terms")}
        />
        {/* Guideline 1.4.1: the citations behind every number the app computes
            have to be easy for the USER to find, not only for a reviewer who
            opens the public URL. This is the permanent address for them
            inside the app; the "Odakle ovaj broj?" links on the screens that
            show the numbers point at the same page. */}
        <SettingsLinkRow
          href="/profil/izvori"
          icon={BookOpen}
          label={t("sources.link.settings")}
          description={t("sources.link.settingsDesc")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.group.support")}>
        <SettingsLinkRow
          href={`mailto:${SUPPORT_EMAIL}`}
          external
          icon={LifeBuoy}
          label={t("settings.contact")}
          value={SUPPORT_EMAIL}
        />
        <SettingsInfoRow
          icon={FileText}
          label={t("settings.version")}
          value={APP_VERSION}
        />
      </SettingsGroup>

      <SettingsGroup>
        <form action={signOutAction}>
          <button
            type="submit"
            className="block w-full text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <LogOut className="size-[18px]" aria-hidden={true} />
              </span>
              <span className="text-sm font-medium text-foreground">
                {t("settings.signout")}
              </span>
            </div>
          </button>
        </form>
      </SettingsGroup>

      <SettingsGroup>
        <DeleteAccountDialog
          trigger={
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-[18px]" aria-hidden={true} />
              </span>
              <span className="text-sm font-medium text-destructive">
                {t("settings.delete")}
              </span>
            </div>
          }
        />
      </SettingsGroup>

      <MedicalDisclaimer />
    </main>
  );
}
