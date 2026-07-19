import Link from "next/link";

import { AdminFoodForm } from "@/components/admin/admin-food-form";

/**
 * F035 / AS-061 + AS-064: `/admin/hrana/novi` -- manually create a verified
 * food (the PRD Addendum-1 seeding workflow). Reachable only by an admin
 * (`src/app/admin/layout.tsx`'s `requireAdmin()` guards everything under
 * `/admin`). The scan-to-create flow lands here with the decoded GTIN in
 * `?barkod=...`, pre-filling (but not locking) the barcode field.
 */
export default async function AdminNoviProizvodPage({
  searchParams,
}: {
  searchParams: Promise<{ barkod?: string }>;
}) {
  const { barkod } = await searchParams;

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
          Novi proizvod
        </h1>
        <p className="text-sm text-muted-foreground">
          Unesi vrednosti sa deklaracije. Snima se kao provereno.
        </p>
      </div>
      <AdminFoodForm mode="create" initialBarcode={barkod} />
    </main>
  );
}
