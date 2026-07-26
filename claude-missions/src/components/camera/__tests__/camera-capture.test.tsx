import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { CameraCapture } from "@/components/camera/camera-capture";

// The live in-app viewfinder that replaced the "Otvori kameru / Otpremi sliku"
// chooser. jsdom has no camera at all, so `navigator.mediaDevices` is installed
// per test to stand in for a granted, denied, or missing one.

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", {
    value,
    configurable: true,
    writable: true,
  });
}

/** A stream whose tracks record whether they were stopped -- that stop is what
 * turns the phone's camera indicator back off. */
function fakeStream() {
  const track = { stop: vi.fn() };
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    track,
  };
}

function renderCamera(overrides: Partial<React.ComponentProps<typeof CameraCapture>> = {}) {
  return render(
    <CameraCapture
      onCapture={vi.fn()}
      onCancel={vi.fn()}
      fallback={(reason) => <p data-testid="fallback">{reason}</p>}
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CameraCapture", () => {
  it("test_camera_opens_the_viewfinder_without_waiting_for_a_tap", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    renderCamera();

    // The whole point of the change: no chooser screen, no button to press --
    // the camera is requested on mount, so landing here IS the camera.
    await waitFor(() => {
      expect(screen.getByTestId("camera-capture")).toBeInTheDocument();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("camera-shutter")).toBeEnabled();
    });
  });

  it("test_camera_asks_for_the_rear_lens_without_audio", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    renderCamera();

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    const constraints = getUserMedia.mock.calls[0][0];
    // `ideal`, never `exact`: a device that can't honour the rear lens should
    // still hand us a stream instead of throwing OverconstrainedError.
    expect(constraints.video.facingMode).toEqual({ ideal: "environment" });
    // Asking for audio here would put a microphone permission in front of
    // someone who only wants to photograph a plate.
    expect(constraints.audio).toBe(false);
  });

  it("test_denied_camera_falls_back_instead_of_dead_ending", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("no", "NotAllowedError"));
    setMediaDevices({ getUserMedia });

    renderCamera();

    await waitFor(() => {
      expect(screen.getByTestId("fallback")).toBeInTheDocument();
    });
    expect(screen.getByTestId("fallback")).toHaveTextContent(/Dozvoli kameru/);
    expect(screen.queryByTestId("camera-capture")).not.toBeInTheDocument();
  });

  it("test_missing_camera_api_falls_back_with_its_own_reason", async () => {
    // Old browser, or a page served over plain http where getUserMedia simply
    // isn't there.
    setMediaDevices(undefined);

    renderCamera();

    await waitFor(() => {
      expect(screen.getByTestId("fallback")).toHaveTextContent(
        /Ne vidimo kameru/
      );
    });
  });

  it("test_camera_is_released_on_unmount", async () => {
    const { stream, track } = fakeStream();
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) });

    const view = renderCamera();
    await waitFor(() => {
      expect(screen.getByTestId("camera-capture")).toBeInTheDocument();
    });

    view.unmount();

    // Leaving the track running keeps the phone's camera indicator lit after
    // the user has moved on, which reads as the app spying on them.
    expect(track.stop).toHaveBeenCalled();
  });

  it("test_a_failed_shot_is_explained_on_top_of_the_viewfinder", async () => {
    const { stream } = fakeStream();
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) });

    renderCamera({ notice: "Nismo uspeli da prepoznamo obrok." });

    // The viewfinder covers the screen, so the page's own error slot is behind
    // it: an error rendered there would be invisible exactly when it matters.
    await waitFor(() => {
      expect(screen.getByTestId("camera-notice")).toHaveTextContent(
        "Nismo uspeli da prepoznamo obrok."
      );
    });
  });
});
