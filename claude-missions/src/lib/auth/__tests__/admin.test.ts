import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database, Profile } from "@/lib/types/db";

// F033: pure/unit coverage for the admin gate (AS-059, AS-067). Mocks
// `@/lib/supabase/server`'s `createClient()` (which needs a live Next.js
// request context via `next/headers`, unavailable in Vitest) and
// `next/navigation`'s `redirect()` (which real Next.js catches via a thrown
// special error -- mocked here the same way the rest of this codebase
// already mocks `next/navigation`, e.g. `src/app/(app)/__tests__/
// profil.test.tsx`) so `requireAdmin()`'s full decision logic is exercised
// end to end without any of that Next.js runtime machinery.

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ADMIN_ACCESS_DENIED_PATH,
  requireAdmin,
  requireAdminApi,
  resolveAdminSessionForClient,
  toAdminApiResult,
} from "@/lib/auth/admin";

function fakeUser(id: string): User {
  return { id } as User;
}

function fakeProfile(overrides: Partial<Profile>): Profile {
  return {
    user_id: "u1",
    full_name: null,
    // `Profile` requires the key; the optional phone is simply absent here.
    phone: null,
    sex: null,
    birth_year: null,
    height_cm: null,
    weight_kg: null,
    activity_level: null,
    klon_at: null,
    is_admin: false,
    onboarded_at: null,
    rules: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A minimal fake `SupabaseClient` matching the exact chain
 * `resolveAdminSessionForClient` calls: `auth.getUser()` then
 * `from("profiles").select("*").eq("user_id", id).maybeSingle()`. */
function makeFakeClient(opts: {
  user: User | null;
  profile: Profile | null;
  profileError?: { message: string } | null;
}): SupabaseClient<Database> {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: opts.profile,
            error: opts.profileError ?? null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AS-059: resolveAdminSessionForClient -- the pure DB-decision core", () => {
  it("test_AS_059_no_session_at_all_resolves_anonymous", async () => {
    const client = makeFakeClient({ user: null, profile: null });
    const result = await resolveAdminSessionForClient(client);
    expect(result).toEqual({ status: "anonymous" });
  });

  it("test_AS_059_signed_in_user_with_is_admin_false_resolves_not_admin", async () => {
    const client = makeFakeClient({
      user: fakeUser("u1"),
      profile: fakeProfile({ user_id: "u1", is_admin: false }),
    });
    const result = await resolveAdminSessionForClient(client);
    expect(result).toEqual({ status: "not_admin" });
  });

  it("test_AS_059_signed_in_user_with_no_profile_row_resolves_not_admin_not_a_crash", async () => {
    const client = makeFakeClient({ user: fakeUser("u1"), profile: null });
    const result = await resolveAdminSessionForClient(client);
    expect(result).toEqual({ status: "not_admin" });
  });

  it("test_AS_059_signed_in_user_with_a_profile_read_error_resolves_not_admin_fail_closed", async () => {
    const client = makeFakeClient({
      user: fakeUser("u1"),
      profile: null,
      profileError: { message: "boom" },
    });
    const result = await resolveAdminSessionForClient(client);
    expect(result).toEqual({ status: "not_admin" });
  });

  it("test_AS_059_signed_in_user_with_is_admin_true_resolves_ok_with_user_and_profile", async () => {
    const user = fakeUser("u1");
    const profile = fakeProfile({ user_id: "u1", is_admin: true });
    const client = makeFakeClient({ user, profile });
    const result = await resolveAdminSessionForClient(client);
    expect(result).toEqual({ status: "ok", user, profile });
  });
});

describe("AS-059: requireAdmin() -- the page/layout guard", () => {
  it("test_AS_059_anonymous_visitor_is_redirected_to_prijava", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeClient({ user: null, profile: null })
    );

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/prijava");
    expect(redirect).toHaveBeenCalledWith("/prijava");
  });

  it("test_AS_059_authenticated_non_admin_is_redirected_to_the_nemas_pristup_denial_page", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeClient({
        user: fakeUser("u1"),
        profile: fakeProfile({ user_id: "u1", is_admin: false }),
      })
    );

    await expect(requireAdmin()).rejects.toThrow(
      `REDIRECT:${ADMIN_ACCESS_DENIED_PATH}`
    );
    expect(redirect).toHaveBeenCalledWith(ADMIN_ACCESS_DENIED_PATH);
  });

  it("test_AS_059_admin_user_passes_through_without_any_redirect_and_receives_user_and_profile", async () => {
    const user = fakeUser("u1");
    const profile = fakeProfile({ user_id: "u1", is_admin: true });
    vi.mocked(createClient).mockResolvedValue(
      makeFakeClient({ user, profile })
    );

    const result = await requireAdmin();

    expect(result.user.id).toBe("u1");
    expect(result.profile.is_admin).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("AS-067: toAdminApiResult() / requireAdminApi() -- the route-handler/action guard", () => {
  it("test_AS_067_anonymous_maps_to_a_401_json_shaped_denial", () => {
    expect(toAdminApiResult({ status: "anonymous" })).toEqual({
      ok: false,
      status: 401,
      error_sr: expect.any(String),
    });
  });

  it("test_AS_067_not_admin_maps_to_a_403_json_shaped_denial_not_a_silent_allow", () => {
    expect(toAdminApiResult({ status: "not_admin" })).toEqual({
      ok: false,
      status: 403,
      error_sr: expect.any(String),
    });
  });

  it("test_AS_067_ok_maps_to_ok_true_with_user_and_profile_no_redirect_involved", () => {
    const user = fakeUser("u1");
    const profile = fakeProfile({ user_id: "u1", is_admin: true });
    expect(toAdminApiResult({ status: "ok", user, profile })).toEqual({
      ok: true,
      user,
      profile,
    });
  });

  it("test_AS_067_requireAdminApi_never_calls_redirect_for_a_non_admin_session_it_returns_403_instead", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeFakeClient({
        user: fakeUser("u1"),
        profile: fakeProfile({ user_id: "u1", is_admin: false }),
      })
    );

    const result = await requireAdminApi();

    expect(result).toEqual({
      ok: false,
      status: 403,
      error_sr: expect.any(String),
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("test_AS_067_requireAdminApi_returns_ok_true_for_an_admin_session", async () => {
    const user = fakeUser("u1");
    const profile = fakeProfile({ user_id: "u1", is_admin: true });
    vi.mocked(createClient).mockResolvedValue(
      makeFakeClient({ user, profile })
    );

    const result = await requireAdminApi();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("u1");
      expect(result.profile.is_admin).toBe(true);
    }
    expect(redirect).not.toHaveBeenCalled();
  });
});
