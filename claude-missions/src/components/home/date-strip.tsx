import Link from "next/link";

import type { DayCell } from "@/lib/home/date-strip";
import { cn } from "@/lib/utils";

// Cal-AI-style date strip under the wordmark: a row of days, each a circled
// date number under its Serbian weekday. A day the user logged a meal gets a
// solid teal ring; an empty past day gets a dashed ring; the future day is
// faint and not tappable. The day currently being viewed sits on a raised
// card. Tapping a past/today cell navigates to `/danas?dan=YYYY-MM-DD`
// (today links to the bare `/danas`), so the dashboard re-renders for that day.

const SR_MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
];

function accessibleLabel(cell: DayCell): string {
  const [, month, day] = cell.key.split("-").map(Number);
  const date = `${day}. ${SR_MONTHS_SHORT[month! - 1]}`;
  if (cell.isToday) return `Danas, ${date}`;
  return cell.isLogged ? `${date} — uneo si obrok` : date;
}

function DayCircle({ cell }: { cell: DayCell }) {
  const disabled = cell.isFuture || cell.isBeforeStart;
  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
        cell.isLogged
          ? "border-2 border-primary text-foreground"
          : disabled
            ? "border border-dashed border-white/10 text-white/25"
            : cell.isToday
              ? "border border-white/40 text-foreground"
              : "border border-dashed border-white/20 text-muted-foreground"
      )}
    >
      {cell.dayNum}
    </span>
  );
}

function DayCellInner({ cell }: { cell: DayCell }) {
  return (
    <span
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl px-1.5 py-2 transition-colors",
        cell.isSelected && "bg-white/[0.07] ring-1 ring-white/10"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          cell.isFuture || cell.isBeforeStart
            ? "text-white/25"
            : cell.isToday || cell.isSelected
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {cell.dayLabel}
      </span>
      <DayCircle cell={cell} />
    </span>
  );
}

export function DateStrip({ days }: { days: DayCell[] }) {
  return (
    <nav
      aria-label="Izbor dana"
      className="flex items-stretch justify-between gap-0.5"
    >
      {days.map((cell) =>
        cell.isFuture || cell.isBeforeStart ? (
          <div key={cell.key} className="flex-1" aria-hidden="true">
            <DayCellInner cell={cell} />
          </div>
        ) : (
          <Link
            key={cell.key}
            href={cell.isToday ? "/danas" : `/danas?dan=${cell.key}`}
            aria-label={accessibleLabel(cell)}
            aria-current={cell.isSelected ? "page" : undefined}
            className="flex-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <DayCellInner cell={cell} />
          </Link>
        )
      )}
    </nav>
  );
}
