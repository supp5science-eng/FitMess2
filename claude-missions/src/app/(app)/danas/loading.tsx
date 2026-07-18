import { Skeleton } from "@/components/ui/skeleton";

// F027 (clarified "loading = skeleton" answer): Next's route-segment
// `loading.tsx` -- shown automatically while `page.tsx`'s Server Component
// data fetch (`getTodayData`) is in flight, so `/danas` never shows a blank
// screen on first paint.
export default function DanasLoading() {
  return (
    <main
      data-testid="home-loading"
      className="flex flex-1 flex-col gap-8 px-6 py-8"
    >
      <Skeleton className="mx-auto h-[232px] w-[232px] rounded-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </main>
  );
}
