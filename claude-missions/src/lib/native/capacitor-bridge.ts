/**
 * Typed access to the Capacitor bridge that the native shell injects into this
 * page.
 *
 * FitMess loads `https://fitmess.app` inside a Capacitor web view (see
 * `docs/izlazak-u-store.md`), so the SAME JavaScript bundle runs in three
 * places: a desktop browser, a mobile browser / installed PWA, and the store
 * app. Only the last one has `window.Capacitor`.
 *
 * Why the bridge is read off `window` instead of importing `@capacitor/core`:
 * in a remote-mode app the plugin's JS is only a thin proxy over a bridge the
 * shell injects anyway, so importing it would add a dependency to the web
 * bundle and a plugin to the native projects for no behavioural gain. Reading
 * the global keeps this file's cost at zero for the browser build — and, more
 * importantly, keeps the web app buildable and shippable while the native
 * projects are edited by someone else.
 *
 * The corollary is that nothing here may ASSUME a plugin exists. A shell built
 * before a plugin was added still reports `isNativePlatform() === true`, and
 * `Plugins.Whatever` is a proxy that answers every name — calling an
 * unregistered one rejects at call time with "not implemented". So availability
 * is asked, never assumed, and every caller must have an answer for "no".
 */

/** Plugin call shapes, narrowed to exactly what we use. */
interface FilesystemPlugin {
  writeFile(options: {
    path: string;
    data: string;
    directory?: string;
    recursive?: boolean;
  }): Promise<{ uri: string }>;
}

interface SharePlugin {
  share(options: {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
    dialogTitle?: string;
  }): Promise<{ activityType?: string | null }>;
}

/** A listener handle, as every `addListener` resolves to. */
export interface NativeListenerHandle {
  remove(): Promise<void>;
}

/** What the OS answers when asked whether it may show notifications. */
export type NativePermissionState =
  | "prompt"
  | "prompt-with-rationale"
  | "granted"
  | "denied";

/** The device token, as the `registration` event delivers it. */
export interface NativeRegistrationToken {
  value: string;
}

/** A notification as it arrives; only the fields the tap handler reads. */
export interface NativePushNotification {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface NativePushActionEvent {
  actionId: string;
  notification: NativePushNotification;
}

/**
 * `@capacitor/push-notifications`, narrowed to what Podsetnici uses.
 *
 * The registration handshake is the part that surprises: `register()` resolves
 * as soon as the OS has been ASKED, not when it has answered. The token arrives
 * later on the `registration` event, and on failure nothing arrives at all
 * except `registrationError`. So a caller must listen before it registers, and
 * must have a timeout — see `src/lib/push/native.ts`.
 */
interface PushNotificationsPlugin {
  checkPermissions(): Promise<{ receive: NativePermissionState }>;
  requestPermissions(): Promise<{ receive: NativePermissionState }>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  removeAllListeners(): Promise<void>;
  addListener(
    event: "registration",
    handler: (token: NativeRegistrationToken) => void
  ): Promise<NativeListenerHandle>;
  addListener(
    event: "registrationError",
    handler: (error: { error: string }) => void
  ): Promise<NativeListenerHandle>;
  addListener(
    event: "pushNotificationActionPerformed",
    handler: (action: NativePushActionEvent) => void
  ): Promise<NativeListenerHandle>;
}

export type { PushNotificationsPlugin };

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

function bridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as { Capacitor?: CapacitorBridge }).Capacitor;
  return candidate && typeof candidate === "object" ? candidate : null;
}

/**
 * Is the Capacitor runtime present AND reporting a native platform?
 *
 * Distinct from `isNativeApp()` in `src/lib/device/native.ts`, and both are
 * needed: that one reads the User-Agent marker, works on the server and during
 * the very first render, and answers "is this the store app?". This one answers
 * the narrower "can I call plugins right now?", which is false in every browser
 * and also false in the shell before the bridge has been injected.
 */
export function hasCapacitorBridge(): boolean {
  const capacitor = bridge();
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform !== "function") return false;
  try {
    return capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** `"ios"`, `"android"`, `"web"`, or null when the bridge is absent. */
export function nativePlatform(): string | null {
  const capacitor = bridge();
  if (!capacitor || typeof capacitor.getPlatform !== "function") return null;
  try {
    return capacitor.getPlatform();
  } catch {
    return null;
  }
}

/**
 * A plugin, or null when this shell does not carry it.
 *
 * `isPluginAvailable` is the only honest test — see the file header for why
 * truthiness of `Plugins[name]` proves nothing.
 */
export function nativePlugin<T>(name: string): T | null {
  const capacitor = bridge();
  if (!capacitor || !hasCapacitorBridge()) return null;
  if (typeof capacitor.isPluginAvailable !== "function") return null;
  try {
    if (!capacitor.isPluginAvailable(name)) return null;
  } catch {
    return null;
  }
  const plugin = capacitor.Plugins?.[name];
  return plugin ? (plugin as T) : null;
}

export function filesystemPlugin(): FilesystemPlugin | null {
  return nativePlugin<FilesystemPlugin>("Filesystem");
}

export function sharePlugin(): SharePlugin | null {
  return nativePlugin<SharePlugin>("Share");
}

/**
 * Null in every browser, and also null in a shell built before the plugin was
 * added — which is the case that matters, because such a shell is already in
 * someone's hands and must not crash on the settings screen.
 */
export function pushNotificationsPlugin(): PushNotificationsPlugin | null {
  return nativePlugin<PushNotificationsPlugin>("PushNotifications");
}
