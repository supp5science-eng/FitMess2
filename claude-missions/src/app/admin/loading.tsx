import { Skeleton } from "@/components/ui/skeleton";

// Instant skeleton for the `/admin/*` area, shown while an admin page's own
// data read (e.g. the food-review queue) is in flight, so the admin screens
// paint immediately under the persistent admin header instead of blanking.
export default function AdminLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <Skeleton className="h-7 w-48 rounded-md" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-20 w-full rounded-2xl" />
      ))}
    </main>
  );
}
