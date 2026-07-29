/**
 * Thin, framework-free wrappers over the Web Share API for sharing FILES.
 *
 * Same platform reality the data-export button already navigates
 * (`components/settings/export-download-button.tsx`): on iOS a real file only
 * reaches the user through `navigator.share({ files })` (the native sheet),
 * while Android/desktop fall back to a `blob:` download. iOS also only allows
 * `share()` while a user gesture is still "live", so a share that was set up
 * after an `await` may throw `NotAllowedError` -- callers keep the built file
 * and re-share on the next tap. These helpers encode exactly that contract and
 * nothing else, so both the export button and the share-card button can rely on
 * one tested shape.
 */

/** Whether this browser can share these specific files via the native sheet. */
export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * Open the native share sheet for `files`. Returns `"shared"` on success, or
 * `"retry"` when the user cancelled OR the gesture had expired -- both mean
 * "nothing was shared; try again on the next tap without rebuilding".
 */
export async function shareFiles(
  files: File[],
  data?: { title?: string; text?: string }
): Promise<"shared" | "retry"> {
  try {
    await navigator.share({ files, ...data });
    return "shared";
  } catch {
    // AbortError (sheet dismissed) and NotAllowedError (spent gesture) are
    // indistinguishable here and want the same "tap again" recovery.
    return "retry";
  }
}

/** Save a file by clicking a transient object-URL link (Android/desktop path). */
export function saveFileViaLink(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Generous: the browser may still be reading the blob when we revoke.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
