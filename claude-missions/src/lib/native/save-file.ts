/**
 * Handing a generated file (the data export, its PDF report, a share card) to
 * the phone from inside the native shell.
 *
 * Why this exists at all — the browser path does not work in a web view:
 *
 * - **Android's system web view has no Web Share API.** `navigator.share` is
 *   simply undefined there, so the browser code falls through to its fallback.
 * - **And that fallback is a `blob:` link click, which a web view ignores.** A
 *   plain WebView has no download manager; without a native `DownloadListener`
 *   the click does nothing and reports nothing. The user taps "Preuzmi PDF" and
 *   the app sits there, silent. That is the worst possible failure — invisible
 *   to us and unexplainable to them.
 *
 * iOS is the kinder case: WKWebView does implement `navigator.share`, so the
 * browser path is expected to work there. We still prefer the native route on
 * both platforms, because one code path that behaves identically is worth more
 * than two that differ in ways we cannot reproduce on a desk.
 *
 * The route: write the bytes into the app's cache directory, then hand that
 * file's URI to the system share sheet — "Sačuvaj u Fajlove", Drive, Gmail,
 * WhatsApp. The sheet closes back onto the app, so the user is never stranded
 * outside it (the rule in `docs/izlazak-u-store.md` and the reason the browser
 * button stopped navigating to files in the first place).
 *
 * Nothing here is verified on a real Android device yet — there is none on hand
 * (2026-08-09). That is precisely why every branch below ends in a definite
 * answer the caller can show the user, and why "we don't know how to save this"
 * is a returned outcome rather than a swallowed exception.
 */

import { filesystemPlugin, sharePlugin } from "@/lib/native/capacitor-bridge";

export type NativeSaveOutcome =
  /** The share sheet opened and the user picked a destination. */
  | "saved"
  /** The sheet opened and the user dismissed it. The file is still in hand. */
  | "cancelled"
  /** This shell cannot do it — no bridge, or a build without the plugins. */
  | "unsupported";

/**
 * Capacitor's `Directory.CACHE`, as the string the bridge expects.
 *
 * The enum lives in `@capacitor/filesystem`, which we deliberately do not
 * import (see `capacitor-bridge.ts`); the wire value is part of the plugin's
 * public API and is what the enum resolves to.
 *
 * CACHE, not DOCUMENTS: this is a hand-off, not storage. Once the share sheet
 * has copied the bytes wherever the user chose, our copy is litter — and the OS
 * is allowed to reclaim a cache directory on its own, which is exactly the
 * lifetime we want. Writing to DOCUMENTS would instead grow forever and, on
 * iOS, get backed up to iCloud.
 */
const CACHE_DIRECTORY = "CACHE";

/**
 * Try to save `file` through the native share sheet.
 *
 * Returns an outcome for the cases the caller must handle differently; throws
 * only when the plugins are present and genuinely failed (out of disk, write
 * denied), which is a real error worth surfacing as one.
 */
export async function saveFileNatively(file: File): Promise<NativeSaveOutcome> {
  const filesystem = filesystemPlugin();
  const share = sharePlugin();
  if (!filesystem || !share) return "unsupported";

  const path = safeFilename(file.name);
  let uri: string;
  try {
    const written = await filesystem.writeFile({
      path,
      data: await toBase64(file),
      directory: CACHE_DIRECTORY,
      recursive: true,
    });
    uri = written.uri;
  } catch (error) {
    // A plugin that is registered but not implemented on this platform rejects
    // here rather than at the availability check, so the same "we cannot do
    // this" answer has to be reachable from inside the call.
    if (isNotImplemented(error)) return "unsupported";
    throw error;
  }

  try {
    await share.share({ title: file.name, files: [uri] });
    return "saved";
  } catch (error) {
    if (isNotImplemented(error)) return "unsupported";
    // Dismissing the sheet rejects, the same way the Web Share API's
    // `AbortError` does. It is not a failure: the file is written and the next
    // tap can offer it again without rebuilding anything.
    if (isCancellation(error)) return "cancelled";
    throw error;
  }
}

/**
 * `File` → base64, without a data-URI prefix (what the plugin's `data` wants).
 *
 * Encoded in chunks because `String.fromCharCode(...bytes)` spreads every byte
 * into an argument list, and a multi-megabyte export would blow the call stack.
 */
async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

/**
 * A filename that cannot escape the cache directory.
 *
 * The name comes from the server's `Content-Disposition`, so it is ours — but
 * it reaches a filesystem write, and a name is never worth trusting at that
 * distance. Path separators out, leading dots out, length capped.
 */
function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "fitmess-fajl";
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

/** Capacitor's answer when a plugin (or one of its methods) is missing. */
function isNotImplemented(error: unknown): boolean {
  return /not implemented|unimplemented/i.test(errorText(error));
}

/** The user closed the share sheet. Reported as text, not as a code. */
function isCancellation(error: unknown): boolean {
  return /cancel/i.test(errorText(error)) || errorText(error) === "AbortError";
}
