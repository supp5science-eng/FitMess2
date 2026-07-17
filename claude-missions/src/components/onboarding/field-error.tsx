/**
 * F015: inline Serbian field-error message, shared by every step.
 * `role="alert"` so assistive tech announces it the moment it appears --
 * this IS the "Inline Serbian error message + retry affordance; never a
 * blank/broken screen" failure-handling contract for this feature (there is
 * no server call to fail here -- see the F015 handoff's "Decisions made"
 * for why validation errors are this feature's failure surface).
 */
export function FieldError({
  message,
  id,
}: {
  message?: string;
  id?: string;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}
