import { cn } from "@/lib/utils";

/**
 * The AI tab's mark: a soft watercolour sphere in the plate's own inks —
 * cyan and ultramarine kneading slowly, a whisper of rose, edges dissolving
 * into the white paper (see `.fm-ai-orb` in `globals.css`). Pure CSS on a
 * handful of spans, so it can be the AI screen's centrepiece AND sit in the
 * bottom nav at 24px without costing a canvas.
 *
 * Decorative: always `aria-hidden`, the accessible name lives on whatever
 * hosts it (the tab label, the screen heading).
 *
 * `hero` turns on the large-format treatment: heavier blur (the melt into
 * the paper) and the slow weightless bob.
 */
export function AiOrb({
  className,
  hero = false,
}: {
  className?: string;
  hero?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("fm-ai-orb", hero && "fm-ai-orb-hero", className)}
    >
      <span className="fm-ai-orb-body">
        <span className="fm-ai-orb-blob fm-ai-orb-blob-a" />
        <span className="fm-ai-orb-blob fm-ai-orb-blob-b" />
        <span className="fm-ai-orb-blob fm-ai-orb-blob-c" />
        <span className="fm-ai-orb-grain" />
      </span>
    </span>
  );
}
