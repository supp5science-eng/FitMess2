"use client";

import { useState } from "react";

import { formatSteps, type StepsWeek } from "@/lib/steps/steps-week";
import { cn } from "@/lib/utils";

// Analitika "Koraci" card: an interactive, colourful step tracker. Tap any day
// in the 7-day chart and the hero (ring + big number + label) updates to that
// day; today is selected by default. Steps are logged on `/danas`; this card is
// the overview. `null` => a calm empty state.
//
// Colour: an energetic emerald → lime gradient (distinct from the sky-blue
// water card and the calorie card's macro palette).

const GRAD_FROM = "#10B981"; // emerald-500
const GRAD_TO = "#A3E635"; // lime-400
const BAR_GRADIENT = `linear-gradient(to top, ${GRAD_FROM}, ${GRAD_TO})`;

// Ring geometry.
const RING = 108;
const R = 46;
const STROKE = 9;
const CIRC = 2 * Math.PI * R;

export function StepsCard({ week }: { week: StepsWeek | null }) {
  const [selected, setSelected] = useState(6); // default: today (last of 7)

  if (!week) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="text-sm text-muted-foreground">
          Nismo uspeli da učitamo korake. Pokušaj ponovo.
        </p>
      </section>
    );
  }

  const day = week.days[selected] ?? week.days[6]!;
  const remaining = Math.max(0, week.goalSteps - day.steps);
  const dashOffset = CIRC * (1 - day.pct);
  const hint = day.reached
    ? "Cilj ispunjen 🎉"
    : `Još ${formatSteps(remaining)} koraka`;

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
      <Header />

      {/* Hero: selected-day ring + big number */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: RING, height: RING }}>
          <svg
            width={RING}
            height={RING}
            viewBox={`0 0 ${RING} ${RING}`}
            className="-rotate-90"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="stepsGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={GRAD_FROM} />
                <stop offset="100%" stopColor={GRAD_TO} />
              </linearGradient>
            </defs>
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="url(#stepsGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.34,1.4,0.5,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-lg leading-none" aria-hidden="true">
              👟
            </span>
            <span className="text-base font-bold tabular-nums text-foreground">
              {Math.round(day.pct * 100)}%
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {day.longLabel}
          </span>
          <span
            data-testid="steps-selected-value"
            className="text-3xl font-bold tabular-nums text-foreground"
          >
            {formatSteps(day.steps)}
          </span>
          <span className="text-sm text-muted-foreground">
            od {formatSteps(week.goalSteps)} cilj
          </span>
          <span
            className="mt-0.5 text-[11px] font-semibold"
            style={{ color: day.reached ? GRAD_FROM : "var(--muted-foreground)" }}
          >
            {hint}
          </span>
        </div>
      </div>

      {/* Interactive 7-day bars: tap a day to select it. */}
      <div>
        <div className="relative h-[92px]">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${(week.goalSteps / week.maxSteps) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-end justify-between gap-1.5">
            {week.days.map((d, i) => {
              const isSelected = i === selected;
              return (
                <button
                  key={d.dayKey}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={isSelected}
                  aria-label={`${d.longLabel}: ${formatSteps(d.steps)} koraka`}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1 focus-visible:outline-none"
                >
                  {/* reached-goal sparkle marker */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-[10px] leading-none transition-opacity",
                      d.reached ? "opacity-100" : "opacity-0"
                    )}
                  >
                    ✨
                  </span>
                  <span
                    className={cn(
                      "w-full max-w-[24px] rounded-md rounded-b-none transition-all",
                      isSelected
                        ? "opacity-100"
                        : "opacity-55 group-hover:opacity-80"
                    )}
                    style={{
                      height: `${(d.steps / week.maxSteps) * 100}%`,
                      minHeight: d.steps > 0 ? 4 : 0,
                      background: BAR_GRADIENT,
                      boxShadow: isSelected
                        ? `0 0 0 2px var(--card), 0 0 0 4px ${GRAD_FROM}`
                        : undefined,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between gap-1.5">
          {week.days.map((d, i) => (
            <span
              key={d.dayKey}
              className={cn(
                "flex-1 text-center text-[11px] transition-colors",
                i === selected
                  ? "font-bold text-foreground"
                  : d.isToday
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Colourful summary pills */}
      <div className="flex items-center justify-center gap-2.5">
        <StatPill label="Prosek" value={`${formatSteps(week.weekAvgSteps)} /dan`} />
        <StatPill
          label="Cilj ispunjen"
          value={`${week.goalDaysCount}/7 dana`}
          accent
        />
      </div>
    </section>
  );
}

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
      style={
        accent
          ? { borderColor: `${GRAD_FROM}55`, backgroundColor: `${GRAD_FROM}14` }
          : undefined
      }
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${GRAD_FROM}26` }}
      >
        👟
      </span>
      <h2 className="text-lg font-semibold text-foreground">Koraci</h2>
      <span className="ml-auto text-xs text-muted-foreground">7 dana</span>
    </div>
  );
}
