"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// F026 / AS-045: the reusable "delete an existing log entry" confirm.
// Same fixed-position-overlay + `role="alertdialog"` pattern F019's
// `DeleteAccountDialog` established (no shadcn Dialog/AlertDialog primitive
// exists in this codebase -- see `src/components/ui/`) -- a small Serbian
// confirm (not a type-to-confirm phrase like account deletion; deleting one
// log entry is much lower-stakes and reversible-in-spirit by re-logging).
//
// Self-contained trigger + open state (own "Obriši" button) so F027 can drop
// `<LogDeleteConfirm logId={log.id} logName={log.name} onDeleted={...} />`
// directly onto a meal card -- `onDeleted` is the caller's hook to
// re-fetch/recompute the day's remaining budget after a successful delete.

const DELETE_FAILED_ERROR_SR = "Nismo uspeli da obrišemo unos. Pokušaj ponovo.";

interface DeleteLogResponseBody {
  ok: boolean;
  error_sr?: string;
}

export function LogDeleteConfirm({
  logId,
  logName,
  onDeleted,
}: {
  logId: string;
  /** Shown in the confirm message, e.g. "Obrisati unos "Jabuka"?" */
  logName: string;
  /** Called after a successful delete, so the caller can re-fetch/recompute
   * the day's remaining budget. */
  onDeleted?: (logId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function openConfirm() {
    setError(undefined);
    setIsOpen(true);
  }

  function closeConfirm() {
    if (isDeleting) return;
    setIsOpen(false);
    setError(undefined);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/logs/${logId}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as DeleteLogResponseBody;

      if (!response.ok || !body.ok) {
        setError(body.error_sr || DELETE_FAILED_ERROR_SR);
        setIsDeleting(false);
        return;
      }

      setIsDeleting(false);
      setIsOpen(false);
      onDeleted?.(logId);
    } catch {
      setError(DELETE_FAILED_ERROR_SR);
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={openConfirm}
        data-testid="log-delete-open-button"
      >
        Obriši
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          data-testid="log-delete-confirm-overlay"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="log-delete-confirm-title"
            data-testid="log-delete-confirm"
            className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-background p-6 shadow-lg"
          >
            <h2
              id="log-delete-confirm-title"
              className="text-lg font-semibold text-foreground"
            >
              Obrisati unos &ldquo;{logName}&rdquo;?
            </h2>
            <p className="text-sm text-muted-foreground">
              Ova radnja se ne može poništiti.
            </p>

            {error ? (
              <p
                role="alert"
                data-testid="log-delete-error"
                className="text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeConfirm}
                disabled={isDeleting}
                data-testid="log-delete-cancel-button"
              >
                Otkaži
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                data-testid="log-delete-confirm-button"
              >
                {isDeleting ? "Brišemo..." : "Obriši"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
