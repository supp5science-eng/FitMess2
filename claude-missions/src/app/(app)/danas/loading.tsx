import { cookies } from "next/headers";

import { IntroCover } from "@/components/home/intro-cover";
import { Skeleton } from "@/components/ui/skeleton";

// F027 (clarified "loading = skeleton" answer): Next's route-segment
// `loading.tsx` -- shown automatically while `page.tsx`'s Server Component
// data fetch (`getTodayData`) is in flight, so `/danas` never shows a blank
// screen on first paint.
//
// Onboarding exception: when the plan-reveal hands off here it drops the
// `fm_intro` cookie carrying the daily target. During that hand-off we render
// the ring-cover (identical to the reveal's final frame) instead of the
// skeleton, so there is no skeleton flash between the ring and the dashboard.
export default async function DanasLoading() {
  const cookieStore = await cookies();
  const introValue = cookieStore.get("fm_intro")?.value;
  if (introValue) {
    const kcal = Number.parseInt(introValue, 10);
    return <IntroCover stage="cover" kcal={Number.isFinite(kcal) ? kcal : 0} />;
  }

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
