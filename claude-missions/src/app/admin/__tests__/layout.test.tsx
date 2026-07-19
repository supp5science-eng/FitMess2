import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";

import type { Profile } from "@/lib/types/db";

// F033 / AS-059, AS-067: proves `src/app/admin/layout.tsx` actually wires
// `requireAdmin()` as its access boundary -- `resolveAdminSessionForClient`/
// `requireAdmin`'s own decision logic is covered directly in
// `src/lib/auth/__tests__/admin.test.ts`; this file proves the LAYOUT
// component delegates to that guard (never renders `children` before it
// resolves, and propagates a denial instead of ever reaching the page).

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth/admin";
import AdminLayout from "../layout";

function fakeUser(id: string): User {
  return { id } as User;
}

function fakeProfile(overrides: Partial<Profile>): Profile {
  return {
    user_id: "u1",
    full_name: null,
    sex: null,
    birth_year: null,
    height_cm: null,
    weight_kg: null,
    activity_level: null,
    is_admin: true,
    onboarded_at: null,
    rules: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AS-059 / AS-067: /admin's layout enforces requireAdmin() server-side before rendering any admin page", () => {
  it("test_AS_059_admin_layout_awaits_requireAdmin_and_renders_children_once_it_resolves_for_an_admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      user: fakeUser("u1"),
      profile: fakeProfile({}),
    });

    const ui = await AdminLayout({
      children: <div data-testid="admin-child">child content</div>,
    });
    render(ui);

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("admin-child")).toBeInTheDocument();
  });

  it("test_AS_067_admin_layout_propagates_a_denial_from_requireAdmin_without_ever_rendering_children", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(
      new Error("REDIRECT:/nemas-pristup")
    );

    await expect(
      AdminLayout({ children: <div data-testid="admin-child">nope</div> })
    ).rejects.toThrow("REDIRECT:/nemas-pristup");
  });
});
