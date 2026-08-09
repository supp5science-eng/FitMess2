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
 *
 * Inside the STORE APP there is a third platform, and it is the one where both
 * browser paths fail (2026-08-09): Android's web view implements no
 * `navigator.share` at all, and answers a `blob:` link click with nothing --
 * no file, no error. A meal card would have been unshareable there, and the
 * button would have said "Sačuvaj" and then done nothing at all. So the shell's
 * own share sheet comes first (`@/lib/native/save-file`), and only then the two
 * browser routes.
 */

import { isNativeApp } from "@/lib/device/native";
import { saveFileNatively } from "@/lib/native/save-file";
import { filesystemPlugin, sharePlugin } from "@/lib/native/capacitor-bridge";

/**
 * Can the native shell put a file in front of the user right now?
 *
 * One file only: the plugin route writes and shares a single URI, and
 * pretending to share three cards while delivering one would be worse than
 * falling through to the browser path.
 */
function canShareNatively(files: File[]): boolean {
  return files.length === 1 && filesystemPlugin() != null && sharePlugin() != null;
}

/** Whether this platform can share these specific files via a native sheet. */
export function canShareFiles(files: File[]): boolean {
  // Asked by `useShareCapable` to decide whether the button says "Podeli" or
  // "Sačuvaj", so the store app must answer honestly here or the label lies.
  if (canShareNatively(files)) return true;
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
  if (canShareNatively(files)) {
    try {
      const outcome = await saveFileNatively(files[0]);
      if (outcome === "saved") return "shared";
      if (outcome === "cancelled") return "retry";
      // "unsupported" -- an older shell. Fall through to the browser routes,
      // which still work on iOS.
    } catch (error) {
      // A real write failure (no space left). The caller's contract has no
      // error channel, and a share card is a re-runnable, loss-free action, so
      // this reports as "nothing shared, tap again" -- but it must not vanish
      // without a trace, or the next person debugging it has nothing to read.
      console.error("[FitMess] native share failed:", error);
      return "retry";
    }
  }

  try {
    await navigator.share({ files, ...data });
    return "shared";
  } catch {
    // AbortError (sheet dismissed) and NotAllowedError (spent gesture) are
    // indistinguishable here and want the same "tap again" recovery.
    return "retry";
  }
}

/**
 * Save a file by clicking a transient object-URL link (Android/desktop path).
 *
 * Reachable inside the store app only on a shell built before the save plugins
 * shipped, where it does NOTHING -- a web view has no download manager. There
 * is nowhere in the share sheet to say so, so it is at least recorded; the data
 * export, whose whole purpose is producing a file, refuses out loud instead
 * (`components/settings/export-download-button.tsx`).
 */
export function saveFileViaLink(file: File): void {
  if (isNativeApp()) {
    console.error(
      "[FitMess] blob download in a native shell with no share plugins: nothing will happen"
    );
  }
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
