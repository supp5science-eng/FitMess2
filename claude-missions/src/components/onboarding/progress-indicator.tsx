import { cn } from "@/lib/utils";

/**
 * F015: "one question per screen, progress indicator" per the clarified
 * spec. A simple filled bar + "Korak X od Y" (Step X of Y) Serbian label --
 * `role="progressbar"` with `aria-valuenow`/`aria-valuemax` so it's
 * announced correctly by assistive tech (keyboard/labeled-inputs
 * accessibility answer, AS-128).
 */
export function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  /** 1-indexed, e.g. 1 for the first step. */
  currentStep: number;
  totalSteps: number;
}) {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Korak ${currentStep} od ${totalSteps}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full bg-primary transition-all")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        Korak {currentStep} od {totalSteps}
      </span>
    </div>
  );
}
