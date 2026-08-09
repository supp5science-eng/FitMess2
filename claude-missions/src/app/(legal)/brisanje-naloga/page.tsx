import type { Metadata } from "next";

import { AccountDeletion } from "@/components/legal/account-deletion";
import { getT } from "@/lib/i18n/server";
import { ACCOUNT_DELETION_PATH } from "@/lib/legal/paths";

/**
 * `/brisanje-naloga` — the account-deletion page Google Play requires.
 *
 * Play's policy asks for a URL that works *without installing the app*, so
 * this is deliberately reachable with no session at all: the reader may be
 * someone who deleted the app months ago and now wants the data gone too.
 */
export const metadata: Metadata = {
  title: "Brisanje naloga",
  description:
    "Kako da obrišeš svoj FitMess nalog, šta se tačno briše i šta se dešava posle.",
  alternates: { canonical: ACCOUNT_DELETION_PATH },
  robots: { index: true, follow: true },
};

export default async function BrisanjeNalogaPage() {
  const { locale, t } = await getT();
  return <AccountDeletion locale={locale} t={t} />;
}
