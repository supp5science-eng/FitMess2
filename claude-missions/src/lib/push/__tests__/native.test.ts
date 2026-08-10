import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUseNativePush,
  disableNativePush,
  enableNativePush,
  listenForNativePushTaps,
  nativePushPlatform,
} from "../native";

// The native push handshake, tested against a fake Capacitor bridge.
//
// Worth testing rather than eyeballing, because the shape of the plugin invites
// exactly one bug: `register()` resolves when the OS has been ASKED, not when it
// has answered, so code that awaits it and then reads a token gets nothing. The
// happy-path test below is only meaningful because the fake reproduces that
// asynchrony — it fires `registration` a tick AFTER `register()` settles.

type Handler = (payload: unknown) => void;

interface FakePluginOptions {
  permission?: "granted" | "denied" | "prompt";
  /** What happens after `register()` — a token, an error, or silence. */
  outcome?: "token" | "error" | "silent";
  token?: string;
}

function installBridge(options: FakePluginOptions | null, platform = "ios") {
  if (options === null) {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
    return { listeners: new Map<string, Handler>(), removed: 0, calls: [] as string[] };
  }

  const listeners = new Map<string, Handler>();
  const state = { listeners, removed: 0, calls: [] as string[] };
  const {
    permission = "granted",
    outcome = "token",
    token = "token-abc",
  } = options;

  const plugin = {
    checkPermissions: async () => {
      state.calls.push("check");
      return { receive: permission === "granted" ? "granted" : "prompt" };
    },
    requestPermissions: async () => {
      state.calls.push("request");
      return { receive: permission };
    },
    register: async () => {
      state.calls.push("register");
      // The point of the whole test file: the event lands after this resolves.
      setTimeout(() => {
        if (outcome === "token") listeners.get("registration")?.({ value: token });
        if (outcome === "error") {
          listeners.get("registrationError")?.({ error: "no network" });
        }
      }, 0);
    },
    unregister: async () => {
      state.calls.push("unregister");
    },
    removeAllListeners: async () => undefined,
    addListener: async (event: string, handler: Handler) => {
      listeners.set(event, handler);
      return {
        remove: async () => {
          state.removed += 1;
          listeners.delete(event);
        },
      };
    },
  };

  (globalThis as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
    isPluginAvailable: (name: string) => name === "PushNotifications",
    Plugins: { PushNotifications: plugin },
  };

  return state;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { userAgent: "FitMessApp/1.0" });
});

afterEach(() => {
  delete (globalThis as { Capacitor?: unknown }).Capacitor;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("native push availability", () => {
  it("test_native_push_is_absent_in_a_browser", () => {
    installBridge(null);
    expect(canUseNativePush()).toBe(false);
    expect(nativePushPlatform()).toBeNull();
  });

  it("test_native_push_is_absent_in_a_shell_without_the_plugin", () => {
    // A shell built before the plugin was bundled: the bridge is there and
    // reports a native platform, but the plugin is not registered. This is the
    // case that must degrade to an explanation instead of a crash.
    (globalThis as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      isPluginAvailable: () => false,
      Plugins: {},
    };
    expect(canUseNativePush()).toBe(false);
    expect(nativePushPlatform()).toBe("android");
  });

  it("test_native_push_is_available_in_the_store_shell", () => {
    installBridge({});
    expect(canUseNativePush()).toBe(true);
    expect(nativePushPlatform()).toBe("ios");
  });
});

describe("enableNativePush", () => {
  it("test_registration_token_is_stored_with_its_platform", async () => {
    const state = installBridge({ token: "apns-token-1" }, "ios");

    const result = await enableNativePush();

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/podsetnici/pretplata");
    expect(JSON.parse(init.body as string)).toMatchObject({
      platform: "ios",
      deviceToken: "apns-token-1",
    });
    // Both one-shot listeners are released once the token is in hand.
    expect(state.removed).toBe(2);
  });

  it("test_android_registers_under_its_own_platform", async () => {
    installBridge({ token: "fcm-token-2" }, "android");

    await enableNativePush();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      platform: "android",
      deviceToken: "fcm-token-2",
    });
  });

  it("test_a_granted_permission_is_not_asked_for_again", async () => {
    const state = installBridge({ permission: "granted" });

    await enableNativePush();

    expect(state.calls).toContain("check");
    expect(state.calls).not.toContain("request");
  });

  it("test_a_refused_permission_is_reported_and_nothing_is_stored", async () => {
    installBridge({ permission: "denied" });

    const result = await enableNativePush();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("test_a_registration_error_does_not_store_a_subscription", async () => {
    installBridge({ outcome: "error" });

    const result = await enableNativePush();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("test_silence_from_the_push_service_gives_up_instead_of_hanging", async () => {
    vi.useFakeTimers();
    const state = installBridge({ outcome: "silent" });

    const pending = enableNativePush();
    await vi.advanceTimersByTimeAsync(16_000);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/internet/i);
    expect(fetchMock).not.toHaveBeenCalled();
    // The abandoned registration must not leave listeners behind that would
    // resolve a promise nobody is waiting on when a token finally arrives.
    expect(state.removed).toBe(2);
  });

  it("test_a_server_rejection_is_passed_through_in_serbian", async () => {
    installBridge({});
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_sr: "Sesija je istekla." }),
    });

    const result = await enableNativePush();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Sesija je istekla.");
  });

  it("test_a_shell_without_the_plugin_says_unsupported_rather_than_throwing", async () => {
    installBridge(null);
    const result = await enableNativePush();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsupported");
  });
});

describe("disableNativePush", () => {
  it("test_the_device_is_forgotten_server_side_and_unregistered", async () => {
    const state = installBridge({ token: "apns-token-3" });

    await disableNativePush();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({
      deviceToken: "apns-token-3",
    });
    expect(state.calls).toContain("unregister");
  });

  it("test_delivery_still_stops_when_the_token_cannot_be_read_back", async () => {
    const state = installBridge({ outcome: "error" });

    await disableNativePush();

    // No DELETE is possible without a token, but `unregister()` is what
    // actually stops delivery and must still happen.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.calls).toContain("unregister");
  });
});

describe("listenForNativePushTaps", () => {
  async function tapWith(data: Record<string, unknown> | undefined) {
    const state = installBridge({});
    const navigate = vi.fn();
    await listenForNativePushTaps(navigate);
    state.listeners.get("pushNotificationActionPerformed")?.({
      actionId: "tap",
      notification: { data },
    });
    return navigate;
  }

  it("test_a_tap_opens_the_screen_the_reminder_is_about", async () => {
    const navigate = await tapWith({ url: "/danas?dan=2026-08-10" });
    expect(navigate).toHaveBeenCalledWith("/danas?dan=2026-08-10");
  });

  it("test_a_reminder_without_a_destination_lands_on_the_home_screen", async () => {
    const navigate = await tapWith(undefined);
    expect(navigate).toHaveBeenCalledWith("/danas");
  });

  it("test_a_tap_can_never_be_sent_off_site", async () => {
    // A push payload is attacker-shaped input if the sending key ever leaks.
    // `//evil.example` is the one that looks relative and is not.
    expect(await tapWith({ url: "https://evil.example" })).toHaveBeenCalledWith(
      "/danas"
    );
    expect(await tapWith({ url: "//evil.example" })).toHaveBeenCalledWith(
      "/danas"
    );
  });
});
