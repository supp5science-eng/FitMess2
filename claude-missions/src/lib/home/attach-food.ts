import type { Food, Log } from "@/lib/types/db";

/**
 * F027 / AS-049: pure "join" of today's log rows with the (shared-catalog)
 * food rows they reference -- same "two round trips, join in application
 * code" split `src/lib/food/recents.ts`'s `reorderFoodsByIds` established,
 * rather than an embedded Supabase `select("*, food:foods(*)")` (kept
 * consistent with the rest of this codebase, and keeps this piece
 * independently unit-testable with plain fixtures).
 *
 * A log whose `food_id` is null (no catalog food reference at all) or whose
 * referenced food no longer exists (deleted; `logs.food_id` is
 * `on delete set null` per `0004_foods_logs.sql`, but a stale in-flight read
 * could still race a delete) resolves to `food: null` -- callers
 * (`src/components/home/meal-card.tsx`) must handle that by hiding the
 * edit-portion action for that entry (delete still works; see the F026
 * handoff's documented `LOG_FOOD_UNAVAILABLE_ERROR_SR` edge case).
 */
export interface LogWithFood extends Log {
  food: Food | null;
}

export function attachFoodToLogs(logs: Log[], foods: Food[]): LogWithFood[] {
  const foodsById = new Map(foods.map((food) => [food.id, food] as const));

  return logs.map((log) => ({
    ...log,
    food: log.food_id ? (foodsById.get(log.food_id) ?? null) : null,
  }));
}
