import { Skeleton } from "@/components/ui/skeleton";

// Instant settings skeleton, shown automatically by Next while `/profil`'s
// Server Component read is in flight. As a route-segment `loading.tsx` it also
// covers the `/profil/*` sub-pages that don't define their own, so switching
// to the Profil tab (or opening a settings section) paints immediately instead
// of waiting on the network with a blank screen. The bottom-nav `<Link>`
// prefetches this boundary, so the transition feels instant.
export default function ProfilLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Skeleton className="h-8 w-40 rounded-md" />
      {[0, 1, 2].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-[132px] w-full rounded-2xl" />
        </div>
      ))}
    </main>
  );
}
