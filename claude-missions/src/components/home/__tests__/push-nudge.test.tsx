import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// The notification-permission offer on Početna.
//
// The assertions worth having here are the MEASUREMENT ones. Two days after
// this row shipped it had produced zero subscriptions, and nobody could say
// whether people were seeing it and refusing or never seeing it at all — on an
// iPhone in a Safari tab it renders nothing, because Apple only allows
// subscribing from an installed app. Each outcome is now recorded, and these
// tests are what stop that quietly regressing to silence again.

const pushEnvironmentMock = vi.fn();
const notificationPermissionMock = vi.fn();
const enablePushMock = vi.fn();
vi.mock("@/lib/push/client", () => ({
  pushEnvironment: () => pushEnvironmentMock(),
  notificationPermission: () => notificationPermissionMock(),
  enablePush: (...args: unknown[]) => enablePushMock(...args),
}));

const saveWeighInEnabledActionMock = vi.fn();
vi.mock("@/app/(app)/profil/podsetnici/actions", () => ({
  saveWeighInEnabledAction: (...args: unknown[]) =>
    saveWeighInEnabledActionMock(...args),
}));

const recordPushPromptMock = vi.fn();
vi.mock("@/lib/funnel/record", () => ({
  recordPushPrompt: (value: string) => recordPushPromptMock(value),
}));

/** The row reads the VAPID key at module scope, so it has to exist before the
 * import — hence the dynamic import in `renderNudge`. */
vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-vapid-key");

async function renderNudge() {
  const { PushNudge } = await import("@/components/home/push-nudge");
  return act(async () => {
    render(<PushNudge />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  pushEnvironmentMock.mockReturnValue({ state: "ready" });
  notificationPermissionMock.mockReturnValue("default");
  enablePushMock.mockResolvedValue({ ok: true });
  saveWeighInEnabledActionMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PushNudge", () => {
  it("test_offers_and_records_that_it_was_shown", async () => {
    await renderNudge();

    expect(screen.getByTestId("push-nudge")).toBeInTheDocument();
    expect(recordPushPromptMock).toHaveBeenCalledWith("shown");
  });

  it("test_an_iphone_in_a_tab_shows_nothing_but_is_counted", async () => {
    // Apple's rule, not ours: no subscribing outside an installed app. The
    // row cannot help these users, but their number is the difference between
    // "people refuse notifications" and "we can never ask most of them".
    pushEnvironmentMock.mockReturnValue({ state: "needs-install" });

    await renderNudge();

    expect(screen.queryByTestId("push-nudge")).not.toBeInTheDocument();
    expect(recordPushPromptMock).toHaveBeenCalledWith("needs_install");
    expect(recordPushPromptMock).not.toHaveBeenCalledWith("shown");
  });

  it("test_accepting_subscribes_switches_the_reminder_on_and_is_recorded", async () => {
    await renderNudge();

    await act(async () => {
      fireEvent.click(screen.getByTestId("push-nudge-accept"));
    });

    expect(enablePushMock).toHaveBeenCalledWith("test-vapid-key");
    expect(saveWeighInEnabledActionMock).toHaveBeenCalledWith(true);
    expect(recordPushPromptMock).toHaveBeenCalledWith("accepted");
    expect(screen.getByTestId("push-nudge-done")).toBeInTheDocument();
  });

  it("test_declining_is_recorded_and_hides_the_row", async () => {
    await renderNudge();

    await act(async () => {
      fireEvent.click(screen.getByTestId("push-nudge-close"));
    });

    expect(recordPushPromptMock).toHaveBeenCalledWith("declined");
    expect(screen.queryByTestId("push-nudge")).not.toBeInTheDocument();
  });

  it("test_a_denied_permission_is_told_apart_from_a_failure", async () => {
    // Terminal: the browser gives no second prompt, so this user can only come
    // back through the phone's own settings. It must not read as "declined".
    enablePushMock.mockResolvedValue({
      ok: false,
      reason: "denied",
      message: "Notifikacije su blokirane.",
    });

    await renderNudge();
    await act(async () => {
      fireEvent.click(screen.getByTestId("push-nudge-accept"));
    });

    expect(recordPushPromptMock).toHaveBeenCalledWith("denied");
    expect(recordPushPromptMock).not.toHaveBeenCalledWith("accepted");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("test_a_browser_already_asked_is_neither_offered_nor_counted", async () => {
    notificationPermissionMock.mockReturnValue("granted");

    await renderNudge();

    expect(screen.queryByTestId("push-nudge")).not.toBeInTheDocument();
    expect(recordPushPromptMock).not.toHaveBeenCalled();
  });
});
