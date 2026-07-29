"use client";

import { useEffect, useMemo, useState } from "react";

import { FoodListItem } from "@/components/food/food-list-item";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { rankResultsWithRecentsFirst } from "@/lib/food/recents";
import type { Food } from "@/lib/types/db";

// F024: the `/dodaj/pretraga` search screen -- debounced Serbian search
// input calling F023's `GET /api/foods/search`, rendering results with a
// "neprovereno" marker for unverified foods (AS-039) and the user's own
// recently-logged foods ranked above generic matches (AS-040), plus a
// "Nedavno korišćeno" quick-add list when the search box is empty.
//
// "Server-fetched props; minimal client state for interactivity" (clarified
// data-shape answer): `initialRecents` comes from the server component
// (`src/app/(app)/dodaj/pretraga/page.tsx`) which already read it via RLS,
// so this component never needs its own recents fetch on mount -- only the
// live search-as-you-type interaction is client state.

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus = "idle" | "loading" | "success" | "error";

interface SearchResponseBody {
  ok: boolean;
  data?: Food[];
  error_sr?: string;
}

export function SearchScreen({ initialRecents }: { initialRecents: Food[] }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<Food[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  );

  const trimmedQuery = query.trim();
  const recentFoodIds = useMemo(
    () => initialRecents.map((food) => food.id),
    [initialRecents]
  );

  // Debounce: only update `debouncedQuery` (and therefore only fire a
  // request) 300ms after the user stops typing.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    // Nothing to fetch for an empty query -- the JSX below already renders
    // the recents view purely from `trimmedQuery` (the live input value,
    // not this debounced one), so there is no state to reset here.
    if (!debouncedQuery) {
      return;
    }

    let cancelled = false;

    async function runSearch() {
      setStatus("loading");
      setErrorMessage(undefined);
      try {
        const response = await fetch(
          `/api/foods/search?q=${encodeURIComponent(debouncedQuery)}`
        );
        const body = (await response.json()) as SearchResponseBody;
        if (cancelled) return;

        if (!response.ok || !body.ok) {
          setStatus("error");
          setErrorMessage(body.error_sr || t("food.search.failedError"));
          return;
        }

        setResults(body.data ?? []);
        setStatus("success");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(t("food.search.failedError"));
        }
      }
    }

    runSearch();
    return () => {
      cancelled = true;
    };
    // `attempt` is a deliberate manual-retry trigger (incremented by
    // `retry()` below) with no value of its own read inside this effect.
  }, [debouncedQuery, attempt]);

  const rankedResults = useMemo(
    () => rankResultsWithRecentsFirst(results, recentFoodIds),
    [results, recentFoodIds]
  );

  function retry() {
    setAttempt((current) => current + 1);
  }

  // While the debounce timer is still pending after the user typed
  // something (query and debouncedQuery differ, or this is the very first
  // keystroke since mount), treat it the same as "loading" so the skeleton
  // shows immediately instead of a stale empty/idle flash.
  const isAwaitingDebounce =
    trimmedQuery.length > 0 && trimmedQuery !== debouncedQuery;
  const effectiveStatus: SearchStatus =
    isAwaitingDebounce && status !== "error" ? "loading" : status;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("food.search.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("food.search.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="food-search-input">{t("food.search.label")}</Label>
        <Input
          id="food-search-input"
          data-testid="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("food.search.placeholder")}
          autoComplete="off"
          aria-describedby="food-search-help"
        />
        <span id="food-search-help" className="sr-only">
          {t("food.search.help")}
        </span>
      </div>

      <div aria-live="polite">
        {trimmedQuery.length === 0 ? (
          <RecentsSection recents={initialRecents} />
        ) : (
          <SearchResultsSection
            status={effectiveStatus}
            query={debouncedQuery || trimmedQuery}
            results={rankedResults}
            recentFoodIds={recentFoodIds}
            errorMessage={errorMessage}
            onRetry={retry}
          />
        )}
      </div>
    </main>
  );
}

function RecentsSection({ recents }: { recents: Food[] }) {
  const { t } = useT();
  if (recents.length === 0) {
    return (
      <EmptyHint
        testId="search-empty-state"
        body={t("food.search.recentsEmpty")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t("food.search.recentsHeading")}
      </h2>
      <ul className="flex flex-col gap-2" data-testid="recents-list">
        {recents.map((food) => (
          <FoodListItem key={food.id} food={food} isRecent />
        ))}
      </ul>
    </div>
  );
}

function SearchResultsSection({
  status,
  query,
  results,
  recentFoodIds,
  errorMessage,
  onRetry,
}: {
  status: SearchStatus;
  query: string;
  results: Food[];
  recentFoodIds: string[];
  errorMessage?: string;
  onRetry: () => void;
}) {
  const { t } = useT();
  if (status === "loading" || status === "idle") {
    return (
      <ul
        aria-busy="true"
        data-testid="search-loading-skeleton"
        className="flex flex-col gap-2"
      >
        {[0, 1, 2].map((placeholder) => (
          <li key={placeholder}>
            <Skeleton className="h-16 w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p
          role="alert"
          data-testid="search-error"
          className="text-sm font-medium text-destructive"
        >
          {errorMessage}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          data-testid="search-retry-button"
        >
          {t("food.search.retry")}
        </Button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyHint
        testId="search-no-results"
        heading={t("food.search.noResultsHeading", { query })}
        body={t("food.search.noResultsBody")}
      />
    );
  }

  const recentSet = new Set(recentFoodIds);

  return (
    <ul className="flex flex-col gap-2" data-testid="search-results-list">
      {results.map((food) => (
        <FoodListItem
          key={food.id}
          food={food}
          isRecent={recentSet.has(food.id)}
        />
      ))}
    </ul>
  );
}

function EmptyHint({
  testId,
  heading,
  body,
}: {
  testId: string;
  heading?: string;
  body: string;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center"
    >
      {heading ? (
        <p className="text-sm font-medium text-foreground">{heading}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
