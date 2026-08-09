import { afterEach, describe, expect, it, vi } from "vitest";

import { saveFileNatively } from "../save-file";

/**
 * There is no Android device on this desk (2026-08-09), so these tests carry
 * the whole weight of the native save path. They are written against the
 * failure that cannot be seen: a web view where nothing happens and nothing is
 * reported. Every branch below therefore asserts a DEFINITE answer -- "saved",
 * "cancelled", "unsupported" or a thrown error -- and never merely that we did
 * not crash.
 */

const FILE = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "izvoz.pdf", {
    type: "application/pdf",
  });

function stubShell({
  writeFile = vi.fn(async () => ({ uri: "file:///cache/izvoz.pdf" })),
  share = vi.fn(async () => ({ activityType: "com.apple.DocumentManagerUICore" })),
  available = ["Filesystem", "Share"],
}: {
  writeFile?: ReturnType<typeof vi.fn>;
  share?: ReturnType<typeof vi.fn>;
  available?: string[];
} = {}) {
  vi.stubGlobal("Capacitor", {
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => available.includes(name),
    getPlatform: () => "android",
    Plugins: { Filesystem: { writeFile }, Share: { share } },
  });
  return { writeFile, share };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveFileNatively", () => {
  it("test_writes_the_bytes_to_the_cache_and_opens_the_system_share_sheet", async () => {
    const { writeFile, share } = stubShell();

    await expect(saveFileNatively(FILE())).resolves.toBe("saved");

    const written = writeFile.mock.calls[0][0] as {
      path: string;
      data: string;
      directory: string;
    };
    expect(written.path).toBe("izvoz.pdf");
    // Base64 of the four bytes above, with no data-URI prefix: the plugin wants
    // raw base64, and a "data:...;base64," header would be written verbatim.
    expect(written.data).toBe("JVBERg==");
    // CACHE, so the OS may reclaim our copy once the user has saved theirs.
    expect(written.directory).toBe("CACHE");

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ["file:///cache/izvoz.pdf"] })
    );
  });

  it("test_a_browser_gets_unsupported_instead_of_an_exception", async () => {
    // No `window.Capacitor` at all -- every desktop and mobile browser.
    await expect(saveFileNatively(FILE())).resolves.toBe("unsupported");
  });

  it("test_a_shell_built_before_the_plugins_says_unsupported", async () => {
    // The shell binary ships a few times a year; a user on last quarter's
    // build has the bridge but not these plugins. That must be a clean answer
    // the button can turn into a sentence, not a rejected promise.
    stubShell({ available: [] });

    await expect(saveFileNatively(FILE())).resolves.toBe("unsupported");
  });

  it("test_a_registered_but_unimplemented_plugin_still_says_unsupported", async () => {
    // Capacitor answers this at CALL time, not at the availability check.
    stubShell({
      share: vi.fn(async () => {
        throw new Error("Share does not have web implementation.");
      }),
      writeFile: vi.fn(async () => {
        throw new Error("not implemented");
      }),
    });

    await expect(saveFileNatively(FILE())).resolves.toBe("unsupported");
  });

  it("test_dismissing_the_share_sheet_is_not_a_failure", async () => {
    const { share } = stubShell({
      share: vi.fn(async () => {
        throw new Error("Share canceled");
      }),
    });

    await expect(saveFileNatively(FILE())).resolves.toBe("cancelled");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("test_a_real_write_failure_is_raised_rather_than_swallowed", async () => {
    // Out of space, permission refused: the user must be told something is
    // wrong. Returning "unsupported" here would blame the wrong thing.
    stubShell({
      writeFile: vi.fn(async () => {
        throw new Error("ENOSPC: no space left on device");
      }),
    });

    await expect(saveFileNatively(FILE())).rejects.toThrow(/ENOSPC/);
  });

  it("test_a_filename_cannot_escape_the_cache_directory", async () => {
    const { writeFile } = stubShell();
    const file = new File([new Uint8Array([1])], "../../etc/passwd", {
      type: "application/pdf",
    });

    await saveFileNatively(file);

    const { path } = writeFile.mock.calls[0][0] as { path: string };
    expect(path).not.toContain("/");
    expect(path).not.toMatch(/^\.\./);
  });
});
