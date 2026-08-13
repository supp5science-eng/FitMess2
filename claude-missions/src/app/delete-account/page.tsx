import { permanentRedirect } from "next/navigation";

import { ACCOUNT_DELETION_PATH } from "@/lib/legal/paths";

/**
 * `/delete-account` → `/brisanje-naloga` (308). See `src/app/privacy/page.tsx`
 * for why these aliases redirect instead of rendering their own copy.
 */
export default function DeleteAccountAliasPage(): never {
  permanentRedirect(ACCOUNT_DELETION_PATH);
}
