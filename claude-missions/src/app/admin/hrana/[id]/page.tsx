import Link from "next/link";

import { AdminFoodForm } from "@/components/admin/admin-food-form";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
import type { Food } from "@/lib/types/db";

/**
 * F035 / AS-061: `/admin/hrana/[id]` -- edit an existing food (any food:
 * verified, unverified, or removed). Admin-gated by `src/app/admin/layout.tsx`.
 * Reads the food via the privileged admin client (no permissive SELECT policy
 * beyond what already exists; the admin client is used repo-wide for these
 * reads) and hands it to the shared `AdminFoodForm` in edit mode. Verify /
 * remove / restore are separate actions on the queue + search list, so this
 * page only edits content.
 */
export default async function AdminEditFoodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getT();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("foods")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[F035 /admin/hrana/[id]] load failed:", error.message);
    return <NotFoundState message={t("admin.edit.loadError")} t={t} />;
  }
  if (!data) {
    return <NotFoundState message={t("admin.edit.notFound")} t={t} />;
  }

  const food = data as Food;
  const statusLabel = food.is_removed
    ? t("admin.status.removed")
    : food.verified
      ? t("admin.status.verified")
      : t("admin.status.unverified");

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/hrana"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {t("admin.hrana.title")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("admin.edit.title", { name: food.name_sr })}
        </h1>
        <span className="text-xs text-muted-foreground">
          {t("admin.edit.status", { status: statusLabel })}
          {food.source ? ` · ${t("admin.edit.source")}: ${food.source}` : ""}
        </span>
      </div>
      <AdminFoodForm mode="edit" food={food} />
    </main>
  );
}

function NotFoundState({ message, t }: { message: string; t: TFunction }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Link
        href="/admin/hrana"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("admin.backToList")}
      </Link>
    </main>
  );
}
