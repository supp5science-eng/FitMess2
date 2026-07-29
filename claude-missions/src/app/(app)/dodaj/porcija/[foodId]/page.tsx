import Link from "next/link";

import { PortionPicker } from "@/components/food/portion-picker";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
import { createClient } from "@/lib/supabase/server";

/**
 * F025 / AS-041, AS-042: `/dodaj/porcija/[foodId]` -- the portion-picker
 * screen shown after a food is tapped on `/dodaj/pretraga` (F024, see that
 * screen's `FoodListItem` now linking here). Same defensive shape
 * `/dodaj/pretraga`'s own page established (clarified failure-handling
 * answer: "never a blank/broken screen") for both "session expired" and "no
 * such food" -- neither should ever be a raw 404/500.
 *
 * Reads the food via the SESSION-scoped client (`foods_select_all_
 * authenticated` RLS -- every authenticated user may read every food row,
 * this is a shared catalog, not user-owned data) and hands it to the client
 * `PortionPicker`, which owns all portion-entry interactivity + the actual
 * `POST /api/logs` save.
 */
export default async function PorcijaPage({
  params,
}: {
  params: Promise<{ foodId: string }>;
}) {
  const { foodId } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <RetryErrorState t={t} message={t("dodaj.sessionExpired")} />
    );
  }

  const { data: food, error } = await supabase
    .from("foods")
    .select("*")
    .eq("id", foodId)
    .maybeSingle();

  if (error) {
    console.error("[F025 /dodaj/porcija] food lookup failed:", error.message);
  }

  if (error || !food) {
    return <RetryErrorState t={t} message={t("dodaj.foodNotFound")} />;
  }

  return <PortionPicker food={food} />;
}

function RetryErrorState({ t, message }: { t: TFunction; message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p
        role="alert"
        data-testid="porcija-load-error"
        className="text-sm text-destructive"
      >
        {message}
      </p>
      <Link
        href="/dodaj/pretraga"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {t("dodaj.backToSearch")}
      </Link>
    </main>
  );
}
