import { cookies } from "next/headers";
import {
  Bell,
  Download,
  FileText,
  LifeBuoy,
  LogOut,
  Phone,
  ScrollText,
  Shield,
  SlidersHorizontal,
  SunMoon,
  Target,
  Trash2,
  User,
  UtensilsCrossed,
} from "lucide-react";

import { signOutAction } from "../actions";
import { DeleteAccountDialog } from "@/components/profil/delete-account-dialog";
import { RefreshAppButton } from "@/components/settings/refresh-app-button";
import { SettingsGroup } from "@/components/settings/settings-group";
import {
  SettingsInfoRow,
  SettingsLinkRow,
} from "@/components/settings/settings-row";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme/theme";

/**
 * `/profil` -- the "Podešavanja" (Settings) screen.
 *
 * Redesigned (2026-07-19) from a flat stack of buttons into grouped,
 * iOS-style settings sections (`SettingsGroup` + `SettingsLinkRow`), all
 * theme-token styled so it renders in both the dark and the (in-progress)
 * light theme. Server Component: identity/email come from the locally
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

const SUPPORT_EMAIL = "podrska@fitmess.app";
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

  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="px-1 text-2xl font-semibold tracking-tight text-foreground">
        Podešavanja
      </h1>

      <SettingsGroup title="Nalog">
        <SettingsInfoRow
          icon={User}
          label="Email"
          value={email ?? "—"}
        />
        <SettingsLinkRow
          href="/telefon"
          icon={Phone}
          label="Broj telefona"
          value={phone ?? "Dodaj"}
        />
        <SettingsLinkRow
          href="/profil/lozinka"
          icon={Shield}
          label="Promeni lozinku"
        />
      </SettingsGroup>

      <SettingsGroup title="Cilj i plan">
        <SettingsLinkRow
          href="/profil/cilj"
          icon={Target}
          label="Cilj i plan"
          description="Promeni cilj i preračunaj kalorije"
        />
        <SettingsLinkRow
          href="/profil/podaci"
          icon={SlidersHorizontal}
          label="Lični podaci"
          description="Pol, godine, visina, težina, aktivnost"
        />
        <SettingsLinkRow
          href="/profil/pravila"
          icon={UtensilsCrossed}
          label="Pravila ishrane"
        />
      </SettingsGroup>

      <SettingsGroup title="Aplikacija">
        <SettingsInfoRow
          icon={SunMoon}
          label="Izgled"
          trailing={<ThemeToggle initialTheme={theme} />}
        />
        <SettingsLinkRow
          href="/profil/podsetnici"
          icon={Bell}
          label="Podsetnici"
          description="Dnevno podsećanje na unos"
        />
        <RefreshAppButton />
      </SettingsGroup>

      {isAdmin ? (
        <SettingsGroup title="Admin">
          <SettingsLinkRow
            href="/admin"
            icon={Shield}
            label="Admin panel"
          />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Podaci i privatnost">
        <SettingsLinkRow
          href="/api/export"
          external
          icon={Download}
          label="Preuzmi moje podatke"
        />
        <SettingsLinkRow
          href="/profil/privatnost"
          icon={FileText}
          label="Politika privatnosti"
        />
        <SettingsLinkRow
          href="/profil/uslovi"
          icon={ScrollText}
          label="Uslovi korišćenja"
        />
      </SettingsGroup>

      <SettingsGroup title="Podrška">
        <SettingsLinkRow
          href={`mailto:${SUPPORT_EMAIL}`}
          external
          icon={LifeBuoy}
          label="Kontaktiraj podršku"
          value={SUPPORT_EMAIL}
        />
        <SettingsInfoRow
          icon={FileText}
          label="Verzija aplikacije"
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
                Odjavi se
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
                Obriši nalog
              </span>
            </div>
          }
        />
      </SettingsGroup>
    </main>
  );
}
