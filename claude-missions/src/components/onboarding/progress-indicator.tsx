import { cn } from "@/lib/utils";

/**
 * F015: "one question per screen, progress indicator" per the clarified
 * spec. A segmented bar — one pill per step — that fills left-to-right as you
 * advance, plus the "Korak X od Y" (Step X of Y) Serbian label. Each pill
 * eases from muted to `--primary` on a colour transition, so moving Dalje /
 * Nazad reads as a satisfying fill/drain; the current step's pill carries a
 * soft halo so "where am I" is unmistakable at a glance.
 *
 * `role="progressbar"` with `aria-valuenow`/`aria-valuemax` keeps it announced
 * correctly by assistive tech (keyboard/labeled-inputs accessibility answer,
 * AS-128); the colour fade is `motion-reduce`-guarded so reduced-motion users
 * get an instant, non-animated state change.
 */
export function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  /** 1-indexed, e.g. 1 for the first step. */
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Korak ${currentStep} od ${totalSteps}`}
        className="flex w-full items-center gap-1.5"
      >
        {Array.from({ length: totalSteps }).map((_, index) => {
          const filled = index < currentStep;
          const isCurrent = index === currentStep - 1;
          return (
            <span
              key={index}
              aria-hidden
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-500 ease-out motion-reduce:transition-none",
                filled ? "bg-primary" : "bg-muted",
                isCurrent && "ring-2 ring-primary/30"
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        Korak {currentStep} od {totalSteps}
      </span>
    </div>
  );
}
