import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { AdminQueueFood } from "@/lib/food/admin-review";

// F034 / AS-060: proves `src/app/admin/hrana/page.tsx` (a) reads the
// review queue via `listUnverifiedFoods` and hands it to `AdminFoodQueue`
// as server-fetched initial props, and (b) degrades to a real inline
// Serbian error + retry link -- never a blank/broken screen -- when the
// server-side read fails (the failure-test the definition of done calls
// for). Admin-only access itself is enforced by
// `src/app/admin/layout.tsx`'s `requireAdmin()` call (proven in F033's own
// `layout.test.tsx`/`admin.test.ts`, and again live for THIS specific
// gate in `src/lib/food/__tests__/admin-review.integration.test.ts`'s
// AS-060 non-admin-denied case) -- this file does not re-prove that, only
// that the page itself never crashes/renders blank regardless of the data
// layer's outcome.

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/food/admin-review", () => ({
  listUnverifiedFoods: vi.fn(),
}));

// F035 added client children to the page (`AdminScanButton` uses `useRouter`,
// `AdminFoodSearch` fetches on type) -- give them a router + a no-op stats read
// so this page test stays focused on the queue render/error contract.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/food/admin-foods", () => ({
  getFoodStats: vi.fn(async () => ({
    total: 0,
    verified: 0,
    unverified: 0,
    removed: 0,
    bySource: { seed: 0, off: 0, user: 0 },
  })),
}));

import { listUnverifiedFoods } from "@/lib/food/admin-review";
import AdminHranaPage from "../page";

function makeQueueFood(
  overrides: Partial<AdminQueueFood> & { id: string }
): AdminQueueFood {
  return {
    name_sr: "Domaći ajvar",
    brand: null,
    kcal_100g: 220,
    protein_100g: 3,
    carbs_100g: 12,
    fat_100g: 18,
    common_units: [],
    source: "user",
    verified: false,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    submitterEmail: null,
    ...overrides,
  };
}

describe("F034 / AS-060: /admin/hrana page", () => {
  it("test_AS_060_a_successful_read_renders_the_queue_with_the_fetched_foods", async () => {
    vi.mocked(listUnverifiedFoods).mockResolvedValue({
      data: [makeQueueFood({ id: "food-1" })],
      error: null,
    });

    const ui = await AdminHranaPage();
    render(ui);

    expect(screen.getByTestId("admin-hrana-queue-list")).toBeInTheDocument();
    expect(screen.getByTestId("admin-hrana-item-food-1")).toBeInTheDocument();
  });

  it("test_an_empty_queue_renders_the_friendly_empty_state_not_a_blank_screen", async () => {
    vi.mocked(listUnverifiedFoods).mockResolvedValue({ data: [], error: null });

    const ui = await AdminHranaPage();
    render(ui);

    expect(screen.getByTestId("admin-hrana-empty-state")).toBeInTheDocument();
  });

  it("test_a_failed_read_renders_an_inline_serbian_error_with_a_retry_link_never_a_blank_screen", async () => {
    vi.mocked(listUnverifiedFoods).mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const ui = await AdminHranaPage();
    render(ui);

    const error = screen.getByTestId("admin-hrana-load-error");
    expect(error).toHaveTextContent(/nismo uspeli da učitamo/i);
    expect(screen.getByRole("link", { name: /pokušaj ponovo/i })).toHaveAttribute(
      "href",
      "/admin/hrana"
    );
    expect(screen.queryByTestId("admin-hrana-queue-list")).not.toBeInTheDocument();
  });
});
