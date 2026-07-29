import Link from "next/link";

import { AdminFoodQueue } from "@/components/admin/admin-food-queue";
import { AdminFoodSearch } from "@/components/admin/admin-food-search";
import { AdminFoodStats } from "@/components/admin/admin-food-stats";
import { AdminScanButton } from "@/components/admin/admin-scan-button";
import { getFoodStats } from "@/lib/food/admin-foods";
import { listUnverifiedFoods } from "@/lib/food/admin-review";
import { createAdminClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * F034 / AS-060: `/admin/hrana` -- the admin review queue. Reachable only
 * by an `is_admin=true` profile: `src/app/admin/layout.tsx`'s
 * `requireAdmin()` call already guards every route nested under `/admin`,
 * so this page does not repeat that check itself (same precedent the F033
 * handoff documents -- "or just nest it under src/app/admin/layout.tsx,
 * which already runs it").
 *
 * Server Component reads every `verified = false, is_removed = false` food
 * via the privileged admin client (`createAdminClient()` -- `public.foods`
 * has no permissive SELECT-everything-including-submitter-email policy;
 * the submitter email lookup inside `listUnverifiedFoods` needs
 * `auth.admin.getUserById`, which only the service-role client can call)
 * and hands the result to the client `AdminFoodQueue` as server-fetched
 * initial props (clarified data-shape answer) -- only the verify/remove
 * interactions are client state.
 */
const ZERO_STATS = {
  total: 0,
  verified: 0,
  unverified: 0,
  removed: 0,
  bySource: { seed: 0, off: 0, user: 0 },
} as const;

export default async function AdminHranaPage() {
  const { t } = await getT();
  const admin = createAdminClient();
  const { data, error } = await listUnverifiedFoods(admin);

  if (error) {
    console.error("[F034 /admin/hrana] listUnverifiedFoods failed:", error.message);
    return <LoadErrorState t={t} />;
  }

  // A stats failure must never blank the page -- fall back to zeros.
  let stats;
  try {
    stats = await getFoodStats(admin);
  } catch (statsError) {
    console.error("[F035 /admin/hrana] getFoodStats failed:", statsError);
    stats = ZERO_STATS;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("admin.hrana.title")}
        </h1>
        <Link
          href="/admin/hrana/novi"
          className={cn(buttonVariants({ variant: "default", size: "sm" }))}
        >
          + {t("admin.hrana.newProduct")}
        </Link>
      </div>

      <AdminFoodStats stats={stats} />

      <AdminScanButton />

      <AdminFoodSearch />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("admin.hrana.reviewQueue")}
        </h2>
        <AdminFoodQueue initialFoods={data ?? []} />
      </section>
    </main>
  );
}

function LoadErrorState({ t }: { t: TFunction }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p
        role="alert"
        data-testid="admin-hrana-load-error"
        className="text-sm text-destructive"
      >
        {t("admin.hrana.loadError")}
      </p>
      <Link
        href="/admin/hrana"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {t("admin.retry")}
      </Link>
    </main>
  );
}
