import { cn } from "@/lib/utils";

/**
 * The AI tab's mark: a small molten sphere that slowly burns (see
 * `.fm-ember-orb` in `globals.css`). Pure CSS — three spans, no canvas, no
 * JS — so it can sit in the bottom nav and cost nothing. Decorative: the tab
 * label carries the accessible name, the orb is `aria-hidden`.
 *
 * The active tab's orb glows brighter via the `a[aria-current="page"]`
 * selector in globals.css, so this component has no active prop to thread.
 */
export function EmberOrb({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("fm-ember-orb", className)}>
      <span className="fm-ember-orb-blob fm-ember-orb-blob-a" />
      <span className="fm-ember-orb-blob fm-ember-orb-blob-b" />
      <span className="fm-ember-orb-core" />
    </span>
  );
}
