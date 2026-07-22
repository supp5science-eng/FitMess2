import Link from "next/link";

import { MealCard } from "@/components/home/meal-card";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { Log } from "@/lib/types/db";

// F027 / AS-049: today's logged-meals list, or (clarified empty-state
// answer) a friendly Serbian empty state with a clear next action when
// nothing has been logged yet today.

export function MealList({
  logs,
  onSaved,
  onDeleted,
}: {
  logs: LogWithFood[];
  onSaved: (updatedLog: Log) => void;
  onDeleted: (logId: string) => void;
}) {
  if (logs.length === 0) {
    return (
      <div
        data-testid="home-meals-empty"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center"
      >
        <p className="text-sm text-muted-foreground">
          Još ništa nisi uneo/unela danas.
        </p>
        <Link
          href="/dodaj/obrok"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Slikaj obrok
        </Link>
      </div>
    );
  }

  return (
    <ul data-testid="home-meals-list" className="flex flex-col gap-3">
      {logs.map((log) => (
        <MealCard
          key={log.id}
          log={log}
          food={log.food}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
  );
}
