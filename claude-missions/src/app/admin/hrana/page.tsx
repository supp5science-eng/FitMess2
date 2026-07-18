import Link from "next/link";

import { AdminFoodQueue } from "@/components/admin/admin-food-queue";
import { listUnverifiedFoods } from "@/lib/food/admin-review";
import { createAdminClient } from "@/lib/supabase/server";

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
export default async function AdminHranaPage() {
  const admin = createAdminClient();
  const { data, error } = await listUnverifiedFoods(admin);

  if (error) {
    console.error("[F034 /admin/hrana] listUnverifiedFoods failed:", error.message);
    return <LoadErrorState />;
  }

  return <AdminFoodQueue initialFoods={data ?? []} />;
}

function LoadErrorState() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p
        role="alert"
        data-testid="admin-hrana-load-error"
        className="text-sm text-destructive"
      >
        Nismo uspeli da učitamo red za proveru. Pokušaj ponovo.
      </p>
      <Link
        href="/admin/hrana"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Pokušaj ponovo
      </Link>
    </main>
  );
}
