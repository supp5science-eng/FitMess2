import { cn } from "@/lib/utils";

/**
 * Lofi's avatar — a glossy teal "bead" that gently breathes (see `lofi.css`).
 * Rendered in the chat header, on every Lofi bubble, and on the typing
 * indicator, so Lofi reads as one consistent little character throughout.
 * `thinking` swaps to the stronger pulse while a reply is in flight.
 */
export function LofiAvatar({
  size = 36,
  thinking = false,
  className,
}: {
  size?: number;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("lofi-orb block shrink-0", thinking && "lofi-orb--thinking", className)}
      style={{ width: size, height: size }}
    />
  );
}
