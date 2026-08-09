import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { OfflineNotice } from "../offline-notice";

/** `navigator.onLine` is read-only, so it is redefined per test. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function fire(event: "online" | "offline") {
  act(() => {
    window.dispatchEvent(new Event(event));
  });
}

afterEach(() => {
  setOnline(true);
});

describe("OfflineNotice", () => {
  it("test_it_stays_out_of_the_way_while_the_connection_is_fine", () => {
    setOnline(true);
    render(<OfflineNotice />);

    expect(screen.queryByTestId("offline-notice")).toBeNull();
  });

  it("test_it_appears_when_the_connection_drops", () => {
    setOnline(true);
    render(<OfflineNotice />);

    setOnline(false);
    fire("offline");

    expect(screen.getByTestId("offline-notice")).toHaveTextContent(
      /Nema veze sa internetom/i
    );
  });

  it("test_it_disappears_on_its_own_when_the_connection_returns", () => {
    // There is no retry button, so this is the only way out of the strip. If
    // it did not clear itself the user would be told they are offline for the
    // rest of the session.
    setOnline(false);
    render(<OfflineNotice />);
    expect(screen.getByTestId("offline-notice")).toBeInTheDocument();

    setOnline(true);
    fire("online");

    expect(screen.queryByTestId("offline-notice")).toBeNull();
  });

  it("test_an_app_launched_with_no_connection_shows_it_without_waiting_for_an_event", () => {
    // Opening the app in airplane mode fires no `offline` event -- the state
    // was already offline before we mounted.
    setOnline(false);
    render(<OfflineNotice />);

    expect(screen.getByTestId("offline-notice")).toBeInTheDocument();
  });
});
