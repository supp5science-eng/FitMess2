import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

import { resetPlayedMoments } from "@/components/home/once-a-day";

// The home screen's once-a-day moments remember that they played in module
// state, which outlives the individual renders inside a test file. Without
// this, the first test to play one would silently mute it for every test after
// it -- the exact opposite of the bug the record exists to prevent.
afterEach(() => {
  resetPlayedMoments();
});
