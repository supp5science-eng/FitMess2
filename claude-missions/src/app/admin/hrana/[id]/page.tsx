import Link from "next/link";

import { AdminFoodForm } from "@/components/admin/admin-food-form";
import { createAdminClient } from "@/lib/supabase/server";
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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("foods")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[F035 /admin/hrana/[id]] load failed:", error.message);
    return <NotFoundState message="Nismo uspeli da učitamo namirnicu." />;
  }
  if (!data) {
    return <NotFoundState message="Namirnica nije pronađena." />;
  }

  const food = data as Food;
  const statusLabel = food.is_removed
    ? "Uklonjeno"
    : food.verified
      ? "Provereno"
      : "Neprovereno";

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/hrana"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Hrana
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Izmena: {food.name_sr}
        </h1>
        <span className="text-xs text-muted-foreground">
          Status: {statusLabel}
          {food.source ? ` · izvor: ${food.source}` : ""}
        </span>
      </div>
      <AdminFoodForm mode="edit" food={food} />
    </main>
  );
}

function NotFoundState({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Link
        href="/admin/hrana"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Nazad na listu
      </Link>
    </main>
  );
}
