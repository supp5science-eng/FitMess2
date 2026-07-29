"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import type { Food } from "@/lib/types/db";

// F035 (agreed addition): search the WHOLE catalog (verified + unverified +
// removed), each result badged with its status and offering inline
// edit/verify/remove/restore. Backed by `GET /api/admin/foods/search`; the
// mutations reuse the same F034/F035 POST routes the review queue uses.

type ActionKind = "verify" | "remove" | "restore";
type Status = "idle" | "loading" | "error";

const MIN_QUERY = 2;

interface FoodResponse {
  ok?: boolean;
  data?: Food | null;
}

export function AdminFoodSearch() {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;

    // All state changes happen inside the (asynchronous) timeout callback --
    // never synchronously in the effect body -- so a short query clears the
    // list without triggering a cascading synchronous re-render.
    const timer = setTimeout(
      async () => {
        if (q.length < MIN_QUERY) {
          setResults([]);
          setStatus("idle");
          return;
        }
        setStatus("loading");
        try {
          const response = await fetch(
            `/api/admin/foods/search?q=${encodeURIComponent(q)}`
          );
          const body = (await response.json()) as {
            ok?: boolean;
            data?: Food[];
          };
          if (cancelled) return;
          if (response.ok && body.ok && body.data) {
            setResults(body.data);
            setStatus("idle");
          } else {
            setStatus("error");
          }
        } catch {
          if (!cancelled) setStatus("error");
        }
      },
      q.length < MIN_QUERY ? 0 : 300
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function runAction(food: Food, kind: ActionKind) {
    setPendingId(food.id);
    try {
      const response = await fetch(`/api/admin/foods/${food.id}/${kind}`, {
        method: "POST",
      });
      const body = (await response.json()) as FoodResponse;
      if (response.ok && body.ok && body.data) {
        const updated = body.data;
        setResults((current) =>
          current.map((f) => (f.id === food.id ? updated : f))
        );
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t("admin.search.title")}
      </h2>
      <Input
        type="search"
        inputMode="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("admin.search.placeholder")}
        aria-label={t("admin.search.aria")}
      />

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("admin.search.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("admin.search.error")}
        </p>
      ) : null}
      {status === "idle" && query.trim().length >= MIN_QUERY && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.search.noResults")}</p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {results.map((food) => (
          <li
            key={food.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {food.name_sr}
                  </p>
                  {food.is_default ? (
                    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      default
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {food.brand ? `${food.brand} · ` : ""}
                  {food.kcal_100g} kcal / 100g
                </p>
              </div>
              <StatusBadge food={food} t={t} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/hrana/${food.id}`}
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("admin.edit")}
              </Link>
              {food.is_removed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pendingId === food.id}
                  onClick={() => runAction(food, "restore")}
                >
                  {t("admin.restore")}
                </Button>
              ) : (
                <>
                  {!food.verified ? (
                    <Button
                      type="button"
                      size="xs"
                      disabled={pendingId === food.id}
                      onClick={() => runAction(food, "verify")}
                    >
                      {t("admin.verify")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={pendingId === food.id}
                    onClick={() => runAction(food, "remove")}
                  >
                    {t("admin.remove")}
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ food, t }: { food: Food; t: TFunction }) {
  const { label, className } = food.is_removed
    ? { label: t("admin.status.removed"), className: "bg-destructive/10 text-destructive" }
    : food.verified
      ? { label: t("admin.status.verified"), className: "bg-primary/10 text-primary" }
      : { label: t("admin.status.unverified"), className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
