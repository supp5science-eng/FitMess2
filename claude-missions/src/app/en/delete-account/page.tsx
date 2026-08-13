import type { Metadata } from "next";

import { AccountDeletion } from "@/components/legal/account-deletion";
import { createT } from "@/lib/i18n/translate";
import {
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_PATH_EN,
  legalAlternates,
} from "@/lib/legal/paths";

/**
 * `/en/delete-account` — the account-deletion page in English.
 *
 * This is the URL to paste into Play Console's "Data deletion" field. Play's
 * reviewers read English and arrive with no cookie, so the cookie-resolved
 * `/brisanje-naloga` would have shown them Serbian; the requirement is that
 * the page be understandable without installing the app, and an unreadable
 * page does not meet it.
 */
export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your FitMess account, exactly what is erased, and what happens afterwards.",
  alternates: legalAlternates(ACCOUNT_DELETION_PATH, ACCOUNT_DELETION_PATH_EN),
  robots: { index: true, follow: true },
};

export default function EnglishDeleteAccountPage() {
  return <AccountDeletion locale="en" t={createT("en")} />;
}
