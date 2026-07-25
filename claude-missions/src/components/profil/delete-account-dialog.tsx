"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GENERIC_DELETE_ERROR_SR =
  "Nešto nije uspelo pri brisanju naloga. Proveri konekciju i pokušaj ponovo.";

/**
 * F019 / AS-015, AS-016: "Obriši nalog" -- self-serve account deletion,
 * gated behind a type-to-confirm dialog (clarified spec: "confirmation
 * dialog on /profil (type-to-confirm ... in Serbian ti form, clearly
 * warning the action is irreversible)").
 *
 * A deliberately simple, dependency-free modal (no shadcn Dialog primitive
 * exists in this codebase yet -- see `src/components/ui/`) rather than
 * pulling in a new Radix/base-ui dialog package for a single feature: a
 * fixed-position overlay + `role="alertdialog"` panel, opened/closed with
 * local `useState`, matching this codebase's existing pattern of small
 * hand-built interactive pieces (e.g. `HabitsScreen`'s inline edit rows)
 * over adding new UI-library surface area.
 *
 * The submit button stays disabled until the user has typed the exact
 * confirmation phrase (`DELETE_CONFIRMATION_PHRASE`, imported from the
 * route itself so the client-side gate and the route's server-side
 * re-validation can never drift out of sync) -- client-side gating is a UX
 * affordance only; the route re-validates the same phrase server-side
 * before touching anything (defense in depth, same posture as every other
 * zod-validated mutation in this codebase).
 *
 * On success, the account (auth user + profiles/targets rows) is already
 * gone and the session cookie already cleared by the route -- this
 * component then does a full navigation (not a client-side `router.push`)
 * to `/prijava` so the now-signed-out visitor lands on a fresh page load,
 * matching `signOutAction`'s own post-sign-out destination (AS-016: the
 * deleted credentials no longer authenticate from that point on).
 */
export function DeleteAccountDialog({
  trigger,
}: {
  /** Optional custom trigger content (e.g. a settings row). Wrapped in a
   * button that opens the dialog. Defaults to a plain destructive button. */
  trigger?: ReactNode;
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const canSubmit = confirmText === DELETE_CONFIRMATION_PHRASE && !isPending;

  function openDialog() {
    setConfirmText("");
    setError(undefined);
    setIsOpen(true);
  }

  function closeDialog() {
    if (isPending) return;
    setIsOpen(false);
    setConfirmText("");
    setError(undefined);
  }

  function handleDelete() {
    if (!canSubmit) return;
    setError(undefined);
    startTransition(async () => {
      try {
        const response = await fetch("/api/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: confirmText }),
        });
        const body = (await response.json()) as {
          ok: boolean;
          error_sr?: string;
        };

        if (!response.ok || !body.ok) {
          setError(body.error_sr || GENERIC_DELETE_ERROR_SR);
          return;
        }

        router.push("/prijava");
        router.refresh();
      } catch {
        setError(GENERIC_DELETE_ERROR_SR);
      }
    });
  }

  return (
    <div>
      {trigger ? (
        <button
          type="button"
          onClick={openDialog}
          data-testid="delete-account-open-button"
          className="block w-full text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {trigger}
        </button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          onClick={openDialog}
          data-testid="delete-account-open-button"
        >
          Obriši nalog
        </Button>
      )}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          data-testid="delete-account-dialog-overlay"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-dialog-title"
            aria-describedby="delete-account-dialog-description"
            data-testid="delete-account-dialog"
            className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <h2
              id="delete-account-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              Obriši nalog zauvek?
            </h2>
            <p
              id="delete-account-dialog-description"
              className="text-sm text-muted-foreground"
            >
              Ova radnja je trajna i ne može se poništiti. Brišemo tvoj
              profil, ciljeve i pravila ishrane, a nalogom se više nećeš moći
              da prijaviš.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-account-confirm-input">
                Da potvrdiš, upiši{" "}
                <span className="font-semibold text-foreground">
                  {DELETE_CONFIRMATION_PHRASE}
                </span>
              </Label>
              <Input
                id="delete-account-confirm-input"
                data-testid="delete-account-confirm-input"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={DELETE_CONFIRMATION_PHRASE}
                autoComplete="off"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "delete-account-error" : undefined}
                disabled={isPending}
              />
            </div>

            {error ? (
              <p
                id="delete-account-error"
                role="alert"
                data-testid="delete-account-error"
                className="text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isPending}
                data-testid="delete-account-cancel-button"
              >
                Otkaži
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!canSubmit}
                data-testid="delete-account-confirm-button"
              >
                {isPending ? "Brišemo..." : "Obriši nalog zauvek"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
