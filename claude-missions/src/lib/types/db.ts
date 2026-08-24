/**
 * Hand-authored TypeScript types for the Postgres schema created by
 * `supabase/migrations/0001_profiles.sql` (F010).
 *
 * These mirror the shape the Supabase CLI's `supabase gen types typescript`
 * would produce (a `Database` interface keyed by schema -> table ->
 * Row/Insert/Update), so `createClient<Database>(...)` / `createAdminClient
 * <Database>(...)` can be adopted by later features without changing this
 * file's public shape. Regenerate via the Supabase CLI/MCP once either is
 * reachable from a worker session and diff against this file rather than
 * hand-editing types out of sync with a migration -- see the F010 handoff
 * for why this had to be hand-authored instead this time.
 *
 * `public.profiles`, `public.targets`, `public.foods`, `public.logs`, and
 * `public.weigh_ins` (F042, see `supabase/migrations/0012_weigh_ins.sql`)
 * exist so far. Later schema features (F050 ai_usage, F057 conversations,
 * ...) each add their own tables here in their own PR -- this file is
 * additive, never replaced wholesale.
 *
 * F017 added `profiles.rules` (a jsonb array, see
 * `supabase/migrations/0003_eating_rules.sql`) -- typed here as
 * `EatingRuleJson[]` rather than the generic `Json` a CLI-generated file
 * would use, since this column's shape is fully controlled by this app (see
 * `src/lib/budget/rules.ts`), matching this file's existing practice of
 * typing `sex`/`activity_level` as narrow unions instead of `string`.
 *
 * F020 added `public.foods` (shared catalog, not user-owned) and
 * `public.logs` (user-owned, own-row RLS) -- see
 * `supabase/migrations/0004_foods_logs.sql`. `foods.common_units` follows
 * the same "typed jsonb array" practice as `profiles.rules` above
 * (`FoodCommonUnit[]` here rather than the generic `Json`).
 *
 * F023 added `public.search_foods(search_query, result_limit)`, a
 * SQL/SECURITY INVOKER RPC function (see
 * `supabase/migrations/0005_food_search.sql`) -- typed under `Functions`
 * below so `supabase.rpc("search_foods", {...})` (see
 * `src/lib/food/search.ts`) gets full argument/return typing instead of
 * `never`.
 */

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

/**
 * The user's overall objective, collected in onboarding and used to drive the
 * budget math (`src/lib/budget/engine.ts`'s `planForGoal`):
 *  - `maintain` / `tone` -> eat at maintenance (TDEE)
 *  - `lose`              -> calorie deficit (target weight below current)
 *  - `gain`             -> calorie surplus (target weight above current)
 */
export type GoalType = "maintain" | "lose" | "gain" | "tone";

/**
 * Trening (0026): how hard a logged session was. Serbian keys, because they
 * are also what the DB check constraint stores -- the catalog in
 * `src/lib/workout/activities.ts` prices each activity at three MET values,
 * one per level.
 */
export type WorkoutIntensity = "lako" | "srednje" | "jako";

/** F017: a single element of `profiles.rules` (jsonb array). See
 * `src/lib/budget/rules.ts`'s `PersistedRule` -- kept as a separate,
 * structurally-identical type here so this file's DB-shape types don't
 * import from `src/lib/budget`. */
export interface EatingRuleJson {
  id: string;
  textSr: string;
  enabled: boolean;
}

/** F020: provenance of a `foods` row. See `supabase/migrations/0004_foods_logs.sql`. */
export type FoodSource = "seed" | "off" | "user";

/** F020: how a `logs` row was created. See `supabase/migrations/0004_foods_logs.sql`. */
export type LogMethod = "search" | "barcode" | "label" | "meal" | "agent";

/**
 * 0019: one line of a logged meal's itemised breakdown, snapshotted onto
 * `logs.components` at log time. Field names mirror the AI schema
 * (`mealComponentSchema` in `src/lib/ai/meal-estimate.ts`) so the estimate is
 * stored verbatim, without a translation layer that could drift.
 *
 * This is what lets "Dodaj još" offer "+2 jaja" on a meal that was
 * photographed as one plate -- see `src/lib/log/add-more.ts`.
 */
export interface LogComponentSnapshot {
  naziv: string;
  grami: number;
  kcal: number;
  protein_g: number;
  uh_g: number;
  mast_g: number;
  /** Natural single unit of this part and its mass ("jaje"/60, "kašika"/15).
   * Absent / 0 = no natural unit, so one step adds the whole line. */
  kom_naziv?: string;
  kom_grami?: number;
}

/** 0017: where a food's fiber/sugar/sodium/saturated-fat values came from --
 * `'label'` read off a real nutrition declaration, `'ai'` estimated from the
 * name + macros (`src/lib/ai/micro-estimate.ts`), `'manual'` typed by a human. */
export type MicroSource = "label" | "ai" | "manual";

/** F020: a single element of `foods.common_units` (jsonb array) -- a
 * user-facing portion shortcut, e.g. `{ label: "parce", grams: 50 }`. */
export interface FoodCommonUnit {
  label: string;
  grams: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          phone: string | null;
          sex: Sex | null;
          birth_year: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          activity_level: ActivityLevel | null;
          // 0020: the user's own daily step goal. `null`/absent = automatic,
          // i.e. derived from `activity_level` (see src/lib/steps/step-goal.ts).
          // Optional for the same fixture reason as the `logs` micro columns.
          daily_step_goal?: number | null;
          is_admin: boolean;
          onboarded_at: string | null;
          rules: EatingRuleJson[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          phone?: string | null;
          sex?: Sex | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          activity_level?: ActivityLevel | null;
          daily_step_goal?: number | null;
          is_admin?: boolean;
          onboarded_at?: string | null;
          rules?: EatingRuleJson[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          phone?: string | null;
          sex?: Sex | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          activity_level?: ActivityLevel | null;
          daily_step_goal?: number | null;
          is_admin?: boolean;
          onboarded_at?: string | null;
          rules?: EatingRuleJson[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      targets: {
        Row: {
          id: string;
          user_id: string;
          daily_kcal: number;
          protein_g: number;
          fat_g: number;
          carbs_g: number;
          weekly_kcal: number;
          goal: GoalType | null;
          goal_weight_kg: number | null;
          timeframe_weeks: number | null;
          effective_from: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_kcal: number;
          protein_g: number;
          fat_g: number;
          carbs_g: number;
          weekly_kcal: number;
          goal?: GoalType | null;
          goal_weight_kg?: number | null;
          timeframe_weeks?: number | null;
          effective_from?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          daily_kcal?: number;
          protein_g?: number;
          fat_g?: number;
          carbs_g?: number;
          weekly_kcal?: number;
          goal?: GoalType | null;
          goal_weight_kg?: number | null;
          timeframe_weeks?: number | null;
          effective_from?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "targets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      foods: {
        Row: {
          id: string;
          name_sr: string;
          brand: string | null;
          kcal_100g: number;
          protein_100g: number;
          carbs_100g: number;
          fat_100g: number;
          common_units: FoodCommonUnit[];
          source: FoodSource;
          verified: boolean;
          is_default: boolean;
          barcode: string | null;
          // 0012: optional reference price in RSD for the whole product/package
          // (NOT per 100 g). Nullable -- most foods have none.
          price: number | null;
          // 0017 micronutrients, per 100 g. `null` = UNKNOWN, which is NOT the
          // same as 0 (see `0017_micronutrients.sql`): an unknown fiber value
          // must never contribute a confident "0 g" to the day's total.
          // Sodium is in MILLIGRAMS, the other three in grams.
          //
          // Typed OPTIONAL (`?`) rather than plain `| null`: `select("*")`
          // always returns all four, but dozens of hand-built `Food` fixtures
          // across the test suite predate this migration, and every reader goes
          // through `src/lib/nutrition/micro.ts` (which normalises
          // `undefined`/`null` to "unknown" identically). Same reasoning for
          // the `logs` columns below.
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
          submitted_by: string | null;
          label_photo_path: string | null;
          is_removed: boolean;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name_sr: string;
          brand?: string | null;
          kcal_100g?: number;
          protein_100g?: number;
          carbs_100g?: number;
          fat_100g?: number;
          common_units?: FoodCommonUnit[];
          source?: FoodSource;
          verified?: boolean;
          is_default?: boolean;
          barcode?: string | null;
          price?: number | null;
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
          submitted_by?: string | null;
          label_photo_path?: string | null;
          is_removed?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name_sr?: string;
          brand?: string | null;
          kcal_100g?: number;
          protein_100g?: number;
          carbs_100g?: number;
          fat_100g?: number;
          common_units?: FoodCommonUnit[];
          source?: FoodSource;
          verified?: boolean;
          is_default?: boolean;
          barcode?: string | null;
          price?: number | null;
          fiber_100g?: number | null;
          sugar_100g?: number | null;
          sodium_100g?: number | null;
          sat_fat_100g?: number | null;
          micro_source?: MicroSource | null;
          submitted_by?: string | null;
          label_photo_path?: string | null;
          is_removed?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foods_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      weigh_ins: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          weight_kg: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          weight_kg: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          weight_kg?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weigh_ins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * 0028: the first time each user reached a named point in a flow — a
       * questionnaire step being shown, an outcome of the notification-
       * permission offer. Bounded (one row per named point per user) and
       * write-once: the primary key discards every arrival after the first.
       */
      /**
       * 0032 (naplata): paid access, one row per entitled user. NO ROW is the
       * free tier — there is nothing to backfill at signup. Read-only from the
       * app: RLS grants SELECT and nothing else, so every write has to arrive
       * from a payment webhook holding the service-role key.
       */
      entitlements: {
        Row: {
          user_id: string;
          /** `free` | `plus`. A `free` row is possible (a lapsed subscriber). */
          tier: string;
          /** Which rail owns the row: `app_store` | `play` | `stripe` | `manual`. */
          source: string;
          /** End of the paid period; `null` = never expires (manual grant). */
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          tier?: string;
          source: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          tier?: string;
          source?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * 0032 (naplata): AI estimates per user per Belgrade calendar day.
       * SELECT-only from the app — the counter moves solely through the
       * `consume_ai_quota` RPC, because an own-row UPDATE policy would let a
       * user reset their own usage.
       */
      ai_usage: {
        Row: {
          user_id: string;
          /** Belgrade calendar day (`YYYY-MM-DD`), never a UTC date. */
          day: string;
          /** Keeps climbing past the free allowance — the overflow is the point. */
          count: number;
        };
        Insert: {
          user_id: string;
          day: string;
          count?: number;
        };
        Update: {
          user_id?: string;
          day?: string;
          count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      funnel_events: {
        Row: {
          user_id: string;
          /** `onboarding_step` | `push_prompt` — see `@/lib/funnel/events`. */
          event: string;
          /** Step id, or prompt outcome. Same allow-list. */
          value: string;
          /** When the point was FIRST reached; never moves. */
          at: string;
        };
        Insert: {
          user_id: string;
          event: string;
          value: string;
          at?: string;
        };
        Update: {
          user_id?: string;
          event?: string;
          value?: string;
          at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * 0024 (nedeljno merenje): every plan-correction suggestion the weekly
       * trend produced AND the user's answer. Written only when the user taps
       * — the engine never changes a plan on its own.
       */
      plan_adjustments: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day the user answered, `"YYYY-MM-DD"`. */
          day: string;
          old_kcal: number;
          new_kcal: number;
          /** The `TrendStatus` behind it: `"TOO_SLOW"` / `"STALLED"` / `"TOO_FAST"`. */
          reason: string;
          /** false = kept the current plan, which silences the card for 2 weeks. */
          accepted: boolean;
          measured_tdee_kcal: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          old_kcal: number;
          new_kcal: number;
          reason: string;
          accepted: boolean;
          measured_tdee_kcal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          old_kcal?: number;
          new_kcal?: number;
          reason?: string;
          accepted?: boolean;
          measured_tdee_kcal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_adjustments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          user_id: string;
          food_id: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          // 0017 micronutrients, snapshotted for THIS entry (sodium in mg, the
          // rest in grams). `null`/absent = unknown, never 0 -- readers go
          // through `src/lib/nutrition/micro.ts`, which falls back to the
          // referenced food's per-100g value and reports partial coverage.
          // Optional for the same fixture reason as the `foods` columns above.
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          // 0019: itemised breakdown of this entry ("jaja 120 g, tuna 80 g,
          // pavlaka 30 g"), snapshotted at log time by the AI flows. `null`/
          // absent = no breakdown (catalog entry, or logged before 0019) --
          // "Dodaj još" then only offers whole-entry seconds. Optional for the
          // same fixture reason as the micro columns above.
          components?: LogComponentSnapshot[] | null;
          // 0025: what share of the SERVED portion was actually eaten (100 =
          // all of it). The columns above are already the eaten amounts, so
          // every reader ignores this -- it exists only so "Nisam sve pojeo"
          // can recover the served plate and be undone. Optional for the same
          // fixture reason as the columns above.
          eaten_share?: number | null;
          logged_at: string;
          method: LogMethod;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_id?: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          components?: LogComponentSnapshot[] | null;
          eaten_share?: number | null;
          logged_at?: string;
          method: LogMethod;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          food_id?: string | null;
          name?: string;
          grams?: number;
          kcal?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          sat_fat?: number | null;
          components?: LogComponentSnapshot[] | null;
          eaten_share?: number | null;
          logged_at?: string;
          method?: LogMethod;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
        ];
      };
      water_intake: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          /** Total water for the day in millilitres (0..20000). */
          ml: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          ml?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          ml?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "water_intake_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * The user's own corrections to the plan's trust verdict about a past day
       * (migration 0029). One row per user per day; re-answering updates in
       * place. Replaces the `fm_dani` cookie, which did not survive a device
       * change and never appeared in the data export.
       */
      day_answers: {
        Row: {
          id: string;
          user_id: string;
          /** The Belgrade day the answer is ABOUT (a Postgres `date`). */
          day_key: string;
          /** `"complete"` = it really was a light day; `"partial"` = not all logged. */
          answer: string;
          /** The Belgrade day the answer was GIVEN. */
          answered_on: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_key: string;
          answer: string;
          answered_on: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_key?: string;
          answer?: string;
          answered_on?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "day_answers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      step_counts: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          /** Total (manually entered) steps for the day (0..200000). */
          steps: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          steps?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          steps?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "step_counts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Podsetnici (0021): one row per DEVICE the user allowed notifications
       * on. Keyed by `endpoint` — re-subscribing the same device updates it. */
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          /** The push service URL for this device (globally unique). */
          /** Null on native rows, which are addressed by device_token. */
          endpoint: string | null;
          p256dh: string | null;
          auth: string | null;
          /** 'web' | 'ios' | 'android' -- picks the transport (0030). */
          platform: string;
          /** APNs/FCM token for a store-installed app; null on web rows. */
          device_token: string | null;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint?: string | null;
          p256dh?: string | null;
          auth?: string | null;
          platform?: string;
          device_token?: string | null;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string | null;
          p256dh?: string | null;
          auth?: string | null;
          platform?: string;
          device_token?: string | null;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Podsetnici (0021): one row per user — which reminders are on, when. */
      reminder_settings: {
        Row: {
          user_id: string;
          // 0027: the meal nudge REPLACED the fixed-time morning one. No time
          // column on purpose — it fires off the user's own median logging
          // time (src/lib/push/meal-rhythm.ts). Optional for the same reason
          // as the 0024 columns below.
          meal_enabled?: boolean;
          /** Belgrade calendar day it last fired (`"YYYY-MM-DD"`), or null. */
          meal_last_sent?: string | null;
          evening_enabled: boolean;
          /** Belgrade wall-clock time, `"HH:MM:SS"` (a Postgres `time`). */
          evening_time: string;
          evening_last_sent: string | null;
          /** The earned "pun dan" push, independent of the scheduled two. */
          award_enabled: boolean;
          // 0024 (nedeljno merenje): the only WEEKLY reminder. Optional here
          // for the same reason as `profiles.daily_step_goal` — a fixture (or
          // an environment where 0024 has not been applied yet) must not fail
          // to typecheck against a column that may not exist.
          weighin_enabled?: boolean;
          /** 0 = Monday .. 6 = Sunday (`belgradeWeekdayIndex`), NOT JS's order. */
          weighin_day?: number;
          weighin_time?: string;
          weighin_last_sent?: string | null;
          // 0027: the hard two-a-day ceiling's bookkeeping.
          sent_day?: string | null;
          sent_count?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          meal_enabled?: boolean;
          meal_last_sent?: string | null;
          evening_enabled?: boolean;
          evening_time?: string;
          evening_last_sent?: string | null;
          award_enabled?: boolean;
          weighin_enabled?: boolean;
          weighin_day?: number;
          weighin_time?: string;
          weighin_last_sent?: string | null;
          sent_day?: string | null;
          sent_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          meal_enabled?: boolean;
          meal_last_sent?: string | null;
          evening_enabled?: boolean;
          evening_time?: string;
          evening_last_sent?: string | null;
          award_enabled?: boolean;
          weighin_enabled?: boolean;
          weighin_day?: number;
          weighin_time?: string;
          weighin_last_sent?: string | null;
          sent_day?: string | null;
          sent_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      awards: {
        Row: {
          user_id: string;
          /** Belgrade calendar day the award was earned for, `"YYYY-MM-DD"`. */
          day: string;
          /** Award identifier; `"pun-dan"` is the only one so far. */
          kind: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          day: string;
          kind?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          day?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "awards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * 0033: one generated avatar ("klon") per user. Built from 5-20 photos
       * that are NEVER stored -- only the drawing that came back is.
       */
      avatar_clones: {
        Row: {
          /** PK + FK to auth.users(id), ON DELETE CASCADE. */
          user_id: string;
          /** The generated character, base64 (no `data:` prefix). */
          image_base64: string;
          mime_type: string;
          /** Which art-direction constant drew it (`CLONE_PROMPT_VERSION`). */
          prompt_version: string;
          /** How many photos went in. Quality signal, never shown. */
          source_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          image_base64: string;
          mime_type?: string;
          prompt_version: string;
          source_count: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          image_base64?: string;
          mime_type?: string;
          prompt_version?: string;
          source_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "avatar_clones_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_photos: {
        Row: {
          /** PK + FK to public.logs(id); one photo per log, ON DELETE CASCADE. */
          log_id: string;
          user_id: string;
          /** Small display thumbnail, base64 (no `data:` prefix). */
          image_base64: string;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          log_id: string;
          user_id: string;
          image_base64: string;
          mime_type?: string;
          created_at?: string;
        };
        Update: {
          log_id?: string;
          user_id?: string;
          image_base64?: string;
          mime_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_photos_log_id_fkey";
            columns: ["log_id"];
            isOneToOne: true;
            referencedRelation: "logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_photos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_checks: {
        Row: {
          id: string;
          user_id: string;
          /** Rule id from the catalog in `src/lib/budget/rules.ts`. */
          habit_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          day: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          day?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_checks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Trening (0026): one row per logged session — MANY per day, unlike
       * `step_counts`/`water_intake`. DISPLAY ONLY: these rows never move the
       * calorie budget (the TDEE activity multiplier already pays for training;
       * the plan is corrected from the scale). See the migration header. */
      workouts: {
        Row: {
          id: string;
          user_id: string;
          /** Belgrade calendar day, `"YYYY-MM-DD"` (a Postgres `date`). */
          day: string;
          /** Key into the catalog in `src/lib/workout/activities.ts`. */
          activity_key: string;
          intensity: WorkoutIntensity;
          /** Session length, 1..600 minutes. */
          minutes: number;
          /** NET kcal above resting metabolism, snapshotted at insert time
           * from the user's weight THEN (never recomputed). */
          kcal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          activity_key: string;
          intensity?: WorkoutIntensity;
          minutes: number;
          kcal?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day?: string;
          activity_key?: string;
          intensity?: WorkoutIntensity;
          minutes?: number;
          kcal?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_foods: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: Database["public"]["Tables"]["foods"]["Row"][];
      };
      /**
       * 0032: charges one AI estimate to `auth.uid()` for the given Belgrade
       * day. The user id is NOT an argument — the function reads it itself, so
       * a caller can only ever move their own counter. Returns a single row.
       */
      consume_ai_quota: {
        Args: {
          p_day: string;
        };
        Returns: { used: number; entitled: boolean }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** Ergonomic aliases -- most callers want the row shape, not the full `Database` path. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Target = Database["public"]["Tables"]["targets"]["Row"];
export type TargetInsert = Database["public"]["Tables"]["targets"]["Insert"];
export type TargetUpdate = Database["public"]["Tables"]["targets"]["Update"];

export type Food = Database["public"]["Tables"]["foods"]["Row"];
export type FoodInsert = Database["public"]["Tables"]["foods"]["Insert"];
export type FoodUpdate = Database["public"]["Tables"]["foods"]["Update"];

export type Log = Database["public"]["Tables"]["logs"]["Row"];
export type LogInsert = Database["public"]["Tables"]["logs"]["Insert"];
export type LogUpdate = Database["public"]["Tables"]["logs"]["Update"];

export type WeighIn = Database["public"]["Tables"]["weigh_ins"]["Row"];
export type WeighInInsert = Database["public"]["Tables"]["weigh_ins"]["Insert"];
export type WeighInUpdate = Database["public"]["Tables"]["weigh_ins"]["Update"];

export type MealPhoto = Database["public"]["Tables"]["meal_photos"]["Row"];
export type MealPhotoInsert =
  Database["public"]["Tables"]["meal_photos"]["Insert"];

export type WaterIntake = Database["public"]["Tables"]["water_intake"]["Row"];
export type WaterIntakeInsert =
  Database["public"]["Tables"]["water_intake"]["Insert"];
export type WaterIntakeUpdate =
  Database["public"]["Tables"]["water_intake"]["Update"];

export type HabitCheck = Database["public"]["Tables"]["habit_checks"]["Row"];
export type HabitCheckInsert =
  Database["public"]["Tables"]["habit_checks"]["Insert"];

export type StepCount = Database["public"]["Tables"]["step_counts"]["Row"];
export type StepCountInsert =
  Database["public"]["Tables"]["step_counts"]["Insert"];
export type StepCountUpdate =
  Database["public"]["Tables"]["step_counts"]["Update"];

export type Workout = Database["public"]["Tables"]["workouts"]["Row"];
export type WorkoutInsert = Database["public"]["Tables"]["workouts"]["Insert"];
