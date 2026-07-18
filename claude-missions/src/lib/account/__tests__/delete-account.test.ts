import { describe, expect, it, vi } from "vitest";

import { deleteAccount, ACCOUNT_DELETE_FAILED_ERROR_SR } from "../delete-account";

// F019 / AS-015, AS-016: unit coverage for `deleteAccount`'s core branching
// against a mock admin client -- the live round-trip against a real project
// (real auth user + real profiles/targets rows actually gone, plus the
// deleted credentials failing to authenticate afterwards) is covered by
// `src/app/api/account/delete/__tests__/route.integration.test.ts`.

function makeMockAdmin(options?: {
  deleteUserError?: { message: string };
  residualTargets?: Record<string, unknown>[];
  residualProfile?: Record<string, unknown> | null;
}) {
  const deleteUser = vi
    .fn()
    .mockResolvedValue({ data: {}, error: options?.deleteUserError ?? null });

  const targetsDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const targetsDelete = vi.fn(() => ({ eq: targetsDeleteEq }));
  const targetsSelectEq = vi.fn().mockResolvedValue({
    data: options?.residualTargets ?? [],
    error: null,
  });
  const targetsSelect = vi.fn(() => ({ eq: targetsSelectEq }));

  const profilesDeleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const profilesDelete = vi.fn(() => ({ eq: profilesDeleteEq }));
  const profilesMaybeSingle = vi.fn().mockResolvedValue({
    data: options?.residualProfile === undefined ? null : options.residualProfile,
    error: null,
  });
  const profilesSelectEq = vi.fn(() => ({ maybeSingle: profilesMaybeSingle }));
  const profilesSelect = vi.fn(() => ({ eq: profilesSelectEq }));

  const from = vi.fn((table: string) => {
    if (table === "targets") return { select: targetsSelect, delete: targetsDelete };
    if (table === "profiles") return { select: profilesSelect, delete: profilesDelete };
    throw new Error(`unexpected table in test double: ${table}`);
  });

  return {
    auth: { admin: { deleteUser } },
    from,
    deleteUser,
    targetsDeleteEq,
    profilesDeleteEq,
  };
}

describe("deleteAccount: AS-015 -- deletes the auth user and personal-data rows", () => {
  it("test_AS_015_calls_admin_deleteUser_with_the_given_user_id_and_returns_ok", async () => {
    const admin = makeMockAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteAccount(admin as any, "user-1");

    expect(result.ok).toBe(true);
    expect(admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(admin.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("test_AS_015_defensively_cleans_up_a_residual_targets_row_if_the_cascade_somehow_left_one_behind", async () => {
    const admin = makeMockAdmin({ residualTargets: [{ id: "target-1" }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteAccount(admin as any, "user-1");

    expect(result.ok).toBe(true);
    expect(admin.targetsDeleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("test_AS_015_defensively_cleans_up_a_residual_profiles_row_if_the_cascade_somehow_left_one_behind", async () => {
    const admin = makeMockAdmin({ residualProfile: { user_id: "user-1" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteAccount(admin as any, "user-1");

    expect(result.ok).toBe(true);
    expect(admin.profilesDeleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("test_AS_015_never_attempts_residual_cleanup_when_no_residual_rows_exist", async () => {
    const admin = makeMockAdmin({ residualTargets: [], residualProfile: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccount(admin as any, "user-1");

    expect(admin.targetsDeleteEq).not.toHaveBeenCalled();
    expect(admin.profilesDeleteEq).not.toHaveBeenCalled();
  });
});

describe("deleteAccount: AS-015 -- failure path never leaves a partial write", () => {
  it("test_AS_015_a_failed_admin_deleteUser_returns_a_serbian_error_and_never_touches_any_table", async () => {
    const admin = makeMockAdmin({ deleteUserError: { message: "internal db error" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteAccount(admin as any, "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_sr).toBe(ACCOUNT_DELETE_FAILED_ERROR_SR);
      // Serbian, not a raw/technical message leaking the underlying db error.
      expect(result.error_sr).not.toMatch(/internal db error/i);
    }

    // No partial write: since deleteUser failed, the function must never
    // have reached the residual-row cleanup step at all -- no table was
    // touched.
    expect(admin.from).not.toHaveBeenCalled();
  });
});
