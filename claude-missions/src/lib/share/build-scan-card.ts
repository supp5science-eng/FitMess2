import type { CardFormat } from "@/lib/share/card";

/**
 * Render one "Scan moment" card on the server and return it as a `File`.
 *
 * The single source of truth for the card-build request, shared by:
 *  - `ShareMealSheet` (builds on open, if no cache layer already has it), and
 *  - the meal add-flows (`obrok-flow` / `najtacnije`), which kick a build off
 *    the moment a photo meal is saved so the card is ready before the first
 *    "Podeli" tap.
 *
 * Both paths go through the same `lib/share/card-cache` layers with a
 * byte-identical body, so a save-time prewarm and an open-time build de-dupe
 * onto one render instead of two.
 */
export async function buildScanCard(
  logId: string,
  format: CardFormat
): Promise<File> {
  const response = await fetch("/api/card/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logId, format }),
    credentials: "same-origin",
    cache: "no-store",
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("image/png")) {
    throw new Error("card build failed");
  }
  const blob = await response.blob();
  return new File([blob], `fitmess-${format}.png`, { type: "image/png" });
}
