"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminQueueFood } from "@/lib/food/admin-review";

// F034 / AS-060 (lists unverified foods), AS-062 (verify), AS-063 (remove)
// -- the `/admin/hrana` review queue's interactive half. "Server-fetched
// props; minimal client state for interactivity" (clarified data-shape
// answer): `initialFoods` comes from the server component
// (`src/app/admin/hrana/page.tsx`), which already read it via the
// privileged admin client; only the verify/remove actions and their
// per-row pending/error state are client-side.
//
// A successful verify OR remove both remove the row from THIS list
// (verifying drops the food out of the review queue exactly like the
// server-side query already excludes verified=true rows; removing drops it
// out because it is gone from the catalog) -- no unintended navigation, no
// global state mutated, matching the clarified "no unintended navigation
// or global state mutation" side-effect answer.

const VERIFY_FAILED_ERROR_SR =
  "Nismo uspeli da potvrdimo namirnicu. Pokušaj ponovo.";
const REMOVE_FAILED_ERROR_SR =
  "Nismo uspeli da uklonimo namirnicu. Pokušaj ponovo.";

type RowAction = "verify" | "remove";
type RowStatus = "idle" | "pending" | "error";

interface ActionResponseBody {
  ok: boolean;
  error_sr?: string;
}

export function AdminFoodQueue({
  initialFoods,
}: {
  initialFoods: AdminQueueFood[];
}) {
  const [foods, setFoods] = useState<AdminQueueFood[]>(initialFoods);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function runAction(foodId: string, action: RowAction) {
    setRowStatus((current) => ({ ...current, [foodId]: "pending" }));
    setRowError((current) => {
      const next = { ...current };
      delete next[foodId];
      return next;
    });

    const fallback =
      action === "verify" ? VERIFY_FAILED_ERROR_SR : REMOVE_FAILED_ERROR_SR;

    try {
      const response = await fetch(`/api/admin/foods/${foodId}/${action}`, {
        method: "POST",
      });
      const body = (await response.json()) as ActionResponseBody;

      if (!response.ok || !body.ok) {
        setRowStatus((current) => ({ ...current, [foodId]: "error" }));
        setRowError((current) => ({
          ...current,
          [foodId]: body.error_sr || fallback,
        }));
        return;
      }

      setFoods((current) => current.filter((food) => food.id !== foodId));
      setRowStatus((current) => {
        const next = { ...current };
        delete next[foodId];
        return next;
      });
    } catch {
      setRowStatus((current) => ({ ...current, [foodId]: "error" }));
      setRowError((current) => ({ ...current, [foodId]: fallback }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {foods.length > 0
          ? `${foods.length} u redu za proveru.`
          : "Namirnice koje korisnici dodaju čekaju ovde na tvoju proveru."}
      </p>

      {foods.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="admin-hrana-queue-list">
          {foods.map((food) => (
            <QueueRow
              key={food.id}
              food={food}
              status={rowStatus[food.id] ?? "idle"}
              errorMessage={rowError[food.id]}
              onVerify={() => runAction(food.id, "verify")}
              onRemove={() => runAction(food.id, "remove")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      data-testid="admin-hrana-empty-state"
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center"
    >
      <p className="text-sm font-medium text-foreground">
        Nema namirnica za proveru.
      </p>
      <p className="text-sm text-muted-foreground">
        Sve korisničke prijave su pregledane. Nove prijave će se pojaviti
        ovde čim ih neko doda.
      </p>
    </div>
  );
}

function QueueRow({
  food,
  status,
  errorMessage,
  onVerify,
  onRemove,
}: {
  food: AdminQueueFood;
  status: RowStatus;
  errorMessage?: string;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const kcal = Math.round(food.kcal_100g);
  const isPending = status === "pending";

  return (
    <li
      data-testid={`admin-hrana-item-${food.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid={`admin-hrana-name-${food.id}`}
              className="truncate text-sm font-medium text-foreground"
            >
              {food.name_sr}
            </span>
            <Badge
              variant="outline"
              data-testid={`admin-hrana-badge-neprovereno-${food.id}`}
              className="border-amber-300 bg-amber-50 text-amber-700"
            >
              neprovereno
            </Badge>
          </div>
          {food.brand ? (
            <span className="truncate text-xs text-muted-foreground">
              {food.brand}
            </span>
          ) : null}
          <span
            data-testid={`admin-hrana-macros-${food.id}`}
            className="text-xs text-muted-foreground"
          >
            {kcal} kcal • {food.protein_100g}g P • {food.carbs_100g}g UH •{" "}
            {food.fat_100g}g M (na 100g)
          </span>
          <span
            data-testid={`admin-hrana-submitter-${food.id}`}
            className="text-xs text-muted-foreground"
          >
            Poslao/la: {food.submitterEmail ?? "nepoznat korisnik"}
          </span>
        </div>
        {food.label_photo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={food.label_photo_path}
            alt={`Fotografija nalepnice za ${food.name_sr}`}
            data-testid={`admin-hrana-label-photo-${food.id}`}
            className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : null}
      </div>

      {status === "error" && errorMessage ? (
        <p
          role="alert"
          data-testid={`admin-hrana-error-${food.id}`}
          className="text-xs font-medium text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onVerify}
          disabled={isPending}
          data-testid={`admin-hrana-verify-${food.id}`}
        >
          {isPending ? "Čuvanje..." : "Potvrdi"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onRemove}
          disabled={isPending}
          data-testid={`admin-hrana-remove-${food.id}`}
        >
          {isPending ? "Čuvanje..." : "Ukloni"}
        </Button>
      </div>
    </li>
  );
}
