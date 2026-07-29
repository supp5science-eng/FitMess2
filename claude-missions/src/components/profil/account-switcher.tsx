"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Plus, Users, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  readAccounts,
  removeAccount,
  upsertAccount,
  type RememberedAccount,
} from "@/lib/auth/accounts";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * "Promeni nalog" — the on-device account switcher (F0xx, product ask
 * 2026-07). A Settings row that opens a sheet listing every account remembered
 * on this device (`@/lib/auth/accounts`); tapping one switches into it WITHOUT
 * a password by refreshing that account's stored token into the active
 * session, then hard-navigating to `/danas` so every server read re-resolves
 * as the new user (no cross-user state bleed). "Dodaj drugi nalog" routes to
 * the normal login; the app-wide `AccountsSync` then remembers it. "Uredi"
 * reveals a per-row remove so a shared device can be wiped.
 *
 * `currentUserId` marks the active account (and guarantees it shows in the
 * list even before `AccountsSync` has written it).
 */
export function AccountSwitcher({
  currentUserId,
  currentEmail,
}: {
  currentUserId: string;
  currentEmail: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    // Make sure the current account is present even if AccountsSync hasn't run
    // yet, so the list is never missing "you".
    if (currentEmail) {
      const already = readAccounts().some((a) => a.id === currentUserId);
      if (!already) {
        // No token to hand over yet — capture it best-effort from the live
        // session so a later switch back works; harmless if it fails.
        createClient()
          .auth.getSession()
          .then(({ data }) => {
            if (data.session?.refresh_token) {
              upsertAccount({
                id: currentUserId,
                email: currentEmail,
                refreshToken: data.session.refresh_token,
              });
              setAccounts(readAccounts());
            }
          });
      }
    }
    setAccounts(readAccounts());
    setEditing(false);
    setError(null);
    setOpen(true);
  }

  function close() {
    if (busyId) return; // don't yank the sheet mid-switch
    setOpen(false);
  }

  function addAnother() {
    router.push("/prijava");
  }

  function forget(id: string) {
    removeAccount(id);
    const next = readAccounts();
    setAccounts(next);
    if (next.length === 0) setEditing(false);
  }

  async function switchTo(acc: RememberedAccount) {
    if (busyId) return;
    if (acc.id === currentUserId) {
      setOpen(false);
      return;
    }
    setError(null);
    setBusyId(acc.id);
    const supabase = createClient();

    // Snapshot the currently-active account's freshest token before we swap it
    // out, so switching back later still works.
    try {
      const { data: cur } = await supabase.auth.getSession();
      if (cur.session?.user?.email && cur.session.refresh_token) {
        upsertAccount({
          id: cur.session.user.id,
          email: cur.session.user.email,
          refreshToken: cur.session.refresh_token,
        });
      }
    } catch {
      // Best-effort; proceed with the switch regardless.
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: acc.refreshToken,
    });

    if (refreshError || !data.session) {
      // Token expired or was revoked (e.g. used on another device) — fall back
      // to a normal, password-based sign-in with the email prefilled.
      setBusyId(null);
      router.push(`/prijava?email=${encodeURIComponent(acc.email)}`);
      return;
    }

    // Persist the account's freshly-rotated token, then hard-navigate so the
    // whole app re-renders as the new user with no leftover client state.
    if (data.session.user.email) {
      upsertAccount({
        id: data.session.user.id,
        email: data.session.user.email,
        refreshToken: data.session.refresh_token,
      });
    }
    window.location.assign("/danas");
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="block w-full text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Users className="size-[18px]" aria-hidden={true} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {t("app.account.title")}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {t("app.account.subtitle")}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden={true}
          />
        </div>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-switcher-title"
                className="flex w-full max-w-sm flex-col gap-4 rounded-t-xl border border-border bg-background px-5 py-6 shadow-lg sm:rounded-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="account-switcher-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    {t("app.account.title")}
                  </h2>
                  <div className="flex items-center gap-1">
                    {accounts.some((a) => a.id !== currentUserId) ? (
                      <button
                        type="button"
                        onClick={() => setEditing((e) => !e)}
                        className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {editing ? t("app.account.done") : t("app.account.edit")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={close}
                      aria-label={t("app.common.close")}
                      disabled={busyId !== null}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {accounts.map((acc) => {
                    const isCurrent = acc.id === currentUserId;
                    const isBusy = busyId === acc.id;
                    return (
                      <div
                        key={acc.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left",
                          isCurrent
                            ? "border-primary/40 bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-foreground"
                          aria-hidden="true"
                        >
                          {acc.email.slice(0, 1)}
                        </span>

                        <button
                          type="button"
                          onClick={() => switchTo(acc)}
                          disabled={busyId !== null || editing}
                          className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none disabled:cursor-default"
                        >
                          <span className="truncate text-sm font-medium text-foreground">
                            {acc.email}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {isCurrent ? t("app.account.current") : t("app.account.tapToSwitch")}
                          </span>
                        </button>

                        {isBusy ? (
                          <Loader2
                            className="size-5 shrink-0 animate-spin text-primary"
                            aria-hidden="true"
                          />
                        ) : editing && !isCurrent ? (
                          <button
                            type="button"
                            onClick={() => forget(acc.id)}
                            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            {t("app.account.remove")}
                          </button>
                        ) : isCurrent ? (
                          <Check
                            className="size-5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={addAnother}
                  disabled={busyId !== null}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Plus className="size-5" aria-hidden="true" />
                  </span>
                  {t("app.account.addAnother")}
                </button>

                <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                  {t("app.account.note")}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
